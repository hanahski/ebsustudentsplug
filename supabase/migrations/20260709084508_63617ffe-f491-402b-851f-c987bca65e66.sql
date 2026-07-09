-- Shareable, revocable read-only views of a ticket's live sales + scans.
-- An admin (or the ticket uploader) creates a link, hands out the URL, and
-- can delete it anytime to instantly revoke access.
CREATE TABLE public.ticket_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_share_links TO authenticated;
GRANT ALL ON public.ticket_share_links TO service_role;

ALTER TABLE public.ticket_share_links ENABLE ROW LEVEL SECURITY;

-- Admins can manage every link. The ticket uploader can manage their own links.
CREATE POLICY "admins manage all share links"
  ON public.ticket_share_links FOR ALL TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "uploader manages own ticket share links"
  ON public.ticket_share_links FOR ALL TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.uploader_id = auth.uid())
  )
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.uploader_id = auth.uid())
  );

CREATE INDEX ticket_share_links_ticket_idx ON public.ticket_share_links(ticket_id);
CREATE INDEX ticket_share_links_token_idx ON public.ticket_share_links(token);

-- Public read-only view of the live sales for a ticket, fetched by token.
-- SECURITY DEFINER so anonymous visitors with a valid, non-revoked token can
-- see the buyer roster + scan status without any direct table grants.
CREATE OR REPLACE FUNCTION public.get_ticket_sales_by_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  link public.ticket_share_links%ROWTYPE;
  t public.tickets%ROWTYPE;
  rows jsonb;
BEGIN
  SELECT * INTO link FROM public.ticket_share_links WHERE token = _token;
  IF NOT FOUND OR link.revoked_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'invalid_or_revoked');
  END IF;

  SELECT * INTO t FROM public.tickets WHERE id = link.ticket_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ticket_gone');
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'purchase_id', pr.id,
      'buyer_index', pr.buyer_index,
      'buyer_name', pf.display_name,
      'buyer_id', pr.buyer_id,
      'price_paid', pr.price_paid,
      'used_at', pr.used_at,
      'purchased_at', pr.created_at
    ) ORDER BY pr.buyer_index NULLS LAST, pr.created_at
  ), '[]'::jsonb) INTO rows
  FROM public.ticket_purchases pr
  LEFT JOIN public.profiles pf ON pf.id = pr.buyer_id
  WHERE pr.ticket_id = link.ticket_id;

  RETURN jsonb_build_object(
    'ok', true,
    'ticket', jsonb_build_object(
      'id', t.id,
      'title', t.title,
      'price', t.price,
      'pay_mode', t.pay_mode,
      'created_at', t.created_at
    ),
    'share', jsonb_build_object(
      'label', link.label,
      'created_at', link.created_at
    ),
    'rows', rows,
    'stats', jsonb_build_object(
      'sold', jsonb_array_length(rows),
      'used', (SELECT count(*) FROM public.ticket_purchases WHERE ticket_id = link.ticket_id AND used_at IS NOT NULL),
      'revenue', (SELECT COALESCE(SUM(price_paid), 0) FROM public.ticket_purchases WHERE ticket_id = link.ticket_id)
    )
  );
END $$;

-- Admin/uploader: list all tickets with their sales + scan totals for the sales tab.
CREATE OR REPLACE FUNCTION public.admin_ticket_sales_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  SELECT COALESCE(jsonb_agg(row_to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
  INTO result
  FROM (
    SELECT
      t.id,
      t.title,
      t.price,
      t.pay_mode,
      t.created_at,
      t.uploader_id,
      up.display_name AS uploader_name,
      (SELECT count(*) FROM public.ticket_purchases pr WHERE pr.ticket_id = t.id) AS sold_count,
      (SELECT count(*) FROM public.ticket_purchases pr WHERE pr.ticket_id = t.id AND pr.used_at IS NOT NULL) AS used_count,
      (SELECT COALESCE(SUM(price_paid), 0) FROM public.ticket_purchases pr WHERE pr.ticket_id = t.id) AS revenue
    FROM public.tickets t
    LEFT JOIN public.profiles up ON up.id = t.uploader_id
  ) x;
  RETURN result;
END $$;

-- Realtime on the shares table so the admin UI updates when links are revoked.
ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_share_links;