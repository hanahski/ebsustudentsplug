
ALTER TABLE public.ticket_purchases
  ADD COLUMN IF NOT EXISTS used_at timestamptz,
  ADD COLUMN IF NOT EXISTS scanned_by uuid,
  ADD COLUMN IF NOT EXISTS buyer_index integer;

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY ticket_id ORDER BY created_at) AS rn
  FROM public.ticket_purchases
)
UPDATE public.ticket_purchases tp
   SET buyer_index = r.rn
  FROM ranked r
 WHERE tp.id = r.id AND tp.buyer_index IS NULL;

CREATE OR REPLACE FUNCTION public.buy_ticket(_ticket_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  uid uuid := auth.uid();
  t public.tickets%ROWTYPE;
  bal numeric;
  token text;
  admin boolean;
  cost numeric;
  next_index int;
  pid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  admin := public.is_admin(uid);
  SELECT * INTO t FROM public.tickets WHERE id = _ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;
  IF t.uploader_id = uid AND NOT admin THEN RAISE EXCEPTION 'cannot buy your own ticket'; END IF;

  token := encode(extensions.gen_random_bytes(16), 'hex');
  cost := COALESCE(t.price, 0);

  IF t.pay_mode = 'credits' AND NOT admin THEN
    SELECT credits INTO bal FROM public.profiles WHERE id = uid FOR UPDATE;
    IF bal < cost THEN RAISE EXCEPTION 'insufficient credits'; END IF;
    UPDATE public.profiles SET credits = credits - cost WHERE id = uid;
    UPDATE public.profiles SET credits = credits + cost WHERE id = t.uploader_id;
    INSERT INTO public.credit_transactions (user_id, amount, reason, metadata, balance_after)
      VALUES (uid, -cost, 'buy_ticket', jsonb_build_object('ticket_id', t.id), bal - cost);
  ELSIF t.pay_mode = 'credits' AND admin THEN
    SELECT credits INTO bal FROM public.profiles WHERE id = uid;
    INSERT INTO public.credit_transactions (user_id, amount, reason, metadata, balance_after)
      VALUES (uid, 0, 'buy_ticket', jsonb_build_object('ticket_id', t.id, 'admin_skip', true, 'would_have_cost', cost), bal);
  END IF;

  SELECT COALESCE(MAX(buyer_index), 0) + 1
    INTO next_index
    FROM public.ticket_purchases
   WHERE ticket_id = t.id;

  INSERT INTO public.ticket_purchases (ticket_id, buyer_id, price_paid, qr_token, buyer_index)
    VALUES (t.id, uid, CASE WHEN admin THEN 0 ELSE cost END, token, next_index)
    RETURNING id INTO pid;

  -- Multi-buy: keep the listing browsable; only track most recent buyer for reference.
  UPDATE public.tickets
     SET buyer_id = uid,
         qr_token = token,
         is_sold = false
   WHERE id = t.id;

  RETURN jsonb_build_object(
    'ok', true,
    'admin', admin,
    'purchase_id', pid,
    'buyer_index', next_index,
    'qr_token', token
  );
END $function$;

CREATE OR REPLACE FUNCTION public.verify_ticket(_qr_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  pr public.ticket_purchases%ROWTYPE;
  t public.tickets%ROWTYPE;
  buyer_name text;
BEGIN
  SELECT * INTO pr FROM public.ticket_purchases WHERE qr_token = _qr_token FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'reason', 'not_found');
  END IF;

  SELECT * INTO t FROM public.tickets WHERE id = pr.ticket_id;
  SELECT display_name INTO buyer_name FROM public.profiles WHERE id = pr.buyer_id;

  IF pr.used_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'reason', 'already_used',
      'used_at', pr.used_at,
      'ticket_id', pr.ticket_id,
      'title', t.title,
      'buyer', buyer_name,
      'buyer_index', pr.buyer_index
    );
  END IF;

  UPDATE public.ticket_purchases
     SET used_at = now(), scanned_by = auth.uid()
   WHERE id = pr.id;

  IF auth.uid() IS NOT NULL THEN
    INSERT INTO public.ticket_scans (ticket_id, scanner_id)
    VALUES (pr.ticket_id, auth.uid());
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'ticket_id', pr.ticket_id,
    'purchase_id', pr.id,
    'title', t.title,
    'buyer_id', pr.buyer_id,
    'buyer', buyer_name,
    'buyer_index', pr.buyer_index
  );
END $function$;
