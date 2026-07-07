
-- Grants for tickets and related tables (missing anon/authenticated privileges)
GRANT SELECT ON public.tickets TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;

GRANT SELECT ON public.ticket_purchases TO authenticated;
GRANT INSERT ON public.ticket_purchases TO authenticated;
GRANT ALL ON public.ticket_purchases TO service_role;

-- Allow user_books.price_credits to store fractional credits (0.1, 0.25, etc.)
ALTER TABLE public.user_books
  ALTER COLUMN price_credits TYPE numeric(12,3) USING price_credits::numeric;

-- Fix buy_ticket: it was casting the price to int, dropping decimals like 0.1
CREATE OR REPLACE FUNCTION public.buy_ticket(_ticket_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE uid uuid := auth.uid(); t public.tickets%ROWTYPE; bal numeric; token text; admin boolean; cost numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  admin := public.is_admin(uid);
  SELECT * INTO t FROM public.tickets WHERE id = _ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'ticket not found'; END IF;
  IF t.is_sold THEN RAISE EXCEPTION 'already sold'; END IF;
  IF t.uploader_id = uid AND NOT admin THEN RAISE EXCEPTION 'cannot buy your own ticket'; END IF;
  token := COALESCE(t.qr_token, encode(extensions.gen_random_bytes(16), 'hex'));
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
  UPDATE public.tickets SET is_sold = true, buyer_id = uid, qr_token = token WHERE id = t.id;
  INSERT INTO public.ticket_purchases (ticket_id, buyer_id, price_paid, qr_token)
    VALUES (t.id, uid, CASE WHEN admin THEN 0 ELSE cost END, token);
  RETURN jsonb_build_object('ok', true, 'admin', admin);
END $function$;
