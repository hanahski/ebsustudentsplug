-- Add email_verified flag to profiles for in-app email verification gating.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false;

-- Existing accounts are grandfathered as verified so we don't retroactively
-- block them from buying.
UPDATE public.profiles SET email_verified = true WHERE email_verified = false;

-- Helper: raise a standardized error when the caller hasn't verified email.
CREATE OR REPLACE FUNCTION public.require_email_verified()
RETURNS void
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT email_verified INTO ok FROM public.profiles WHERE id = auth.uid();
  IF NOT COALESCE(ok, false) THEN
    RAISE EXCEPTION 'EMAIL_NOT_VERIFIED';
  END IF;
END $$;

-- Mark email_verified true once a user completes an email OTP verification.
CREATE OR REPLACE FUNCTION public.mark_email_verified()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  UPDATE public.profiles SET email_verified = true WHERE id = auth.uid();
END $$;

-- Gate buy_ticket on email verification (admins pass through as before).
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
  IF NOT admin THEN PERFORM public.require_email_verified(); END IF;
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

-- Gate redeem_coupon on email verification.
CREATE OR REPLACE FUNCTION public.redeem_coupon(_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); c public.coupons%ROWTYPE; new_bal int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  PERFORM public.require_email_verified();
  SELECT * INTO c FROM public.coupons WHERE upper(code) = upper(_code) FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid code'; END IF;
  IF NOT c.is_active THEN RAISE EXCEPTION 'code inactive'; END IF;
  IF c.max_uses IS NOT NULL AND c.used_count >= c.max_uses THEN RAISE EXCEPTION 'code fully redeemed'; END IF;
  IF EXISTS (SELECT 1 FROM public.coupon_redemptions WHERE coupon_id = c.id AND user_id = uid) THEN RAISE EXCEPTION 'already redeemed'; END IF;
  INSERT INTO public.coupon_redemptions (coupon_id, user_id) VALUES (c.id, uid);
  UPDATE public.coupons SET used_count = used_count + 1 WHERE id = c.id;
  IF c.reward_credits > 0 THEN
    UPDATE public.profiles SET credits = credits + c.reward_credits WHERE id = uid RETURNING credits INTO new_bal;
    INSERT INTO public.credit_transactions (user_id, amount, reason, metadata, balance_after) VALUES (uid, c.reward_credits, 'coupon_redeem', jsonb_build_object('code', c.code, 'coupon_id', c.id), new_bal);
  ELSE
    SELECT credits INTO new_bal FROM public.profiles WHERE id = uid;
  END IF;
  IF c.grants_role IS NOT NULL THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (uid, c.grants_role) ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
  RETURN jsonb_build_object('ok', true, 'credits_added', c.reward_credits, 'balance', new_bal, 'role_granted', c.grants_role);
END $function$;
