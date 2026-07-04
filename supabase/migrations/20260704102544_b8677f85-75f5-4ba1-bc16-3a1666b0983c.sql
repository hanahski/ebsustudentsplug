
-- Widen credit-related columns to numeric(12,3) so balances and prices can hold 0.001 increments.
ALTER TABLE public.profiles ALTER COLUMN credits TYPE numeric(12,3);
ALTER TABLE public.credit_transactions ALTER COLUMN amount TYPE numeric(12,3);
ALTER TABLE public.credit_transactions ALTER COLUMN balance_after TYPE numeric(12,3);
ALTER TABLE public.library_books ALTER COLUMN price_credits TYPE numeric(12,3);
ALTER TABLE public.tickets ALTER COLUMN price TYPE numeric(12,3);
ALTER TABLE public.tasks ALTER COLUMN reward_credits TYPE numeric(12,3);
ALTER TABLE public.coupons ALTER COLUMN reward_credits TYPE numeric(12,3);

-- Update RPCs whose signatures pinned integer amounts. Bodies remain compatible with numeric.

CREATE OR REPLACE FUNCTION public.claim_ad_reward(_amount numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  earned_today numeric;
  new_bal numeric;
  daily_cap numeric := 200;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'invalid reward amount'; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO earned_today
  FROM public.credit_transactions
  WHERE user_id = uid AND reason = 'ad_reward' AND created_at::date = current_date;

  IF earned_today + _amount > daily_cap THEN
    RAISE EXCEPTION 'DAILY_LIMIT_REACHED';
  END IF;

  UPDATE public.profiles SET credits = credits + _amount WHERE id = uid RETURNING credits INTO new_bal;
  IF new_bal IS NULL THEN RAISE EXCEPTION 'profile not found'; END IF;

  INSERT INTO public.credit_transactions (user_id, amount, reason, balance_after, metadata)
  VALUES (uid, _amount, 'ad_reward', new_bal, jsonb_build_object('source', 'reward_ad'));

  RETURN jsonb_build_object('ok', true, 'credits_added', _amount, 'balance', new_bal, 'earned_today', earned_today + _amount, 'daily_cap', daily_cap);
END $function$;

CREATE OR REPLACE FUNCTION public.spend_credits(_amount numeric, _reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); bal numeric; admin boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'amount must be positive'; END IF;
  admin := public.is_admin(uid);
  SELECT credits INTO bal FROM public.profiles WHERE id = uid FOR UPDATE;
  IF NOT admin AND bal < _amount THEN RAISE EXCEPTION 'INSUFFICIENT_CREDITS'; END IF;
  IF NOT admin THEN
    UPDATE public.profiles SET credits = credits - _amount WHERE id = uid;
    INSERT INTO public.credit_transactions (user_id, amount, reason, balance_after) VALUES (uid, -_amount, _reason, bal - _amount);
    RETURN jsonb_build_object('ok', true, 'balance', bal - _amount, 'admin', false);
  ELSE
    INSERT INTO public.credit_transactions (user_id, amount, reason, metadata, balance_after) VALUES (uid, 0, _reason, jsonb_build_object('admin_skip', true, 'would_have_cost', _amount), bal);
    RETURN jsonb_build_object('ok', true, 'balance', bal, 'admin', true);
  END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.admin_grant_credits(_user_id uuid, _amount numeric, _reason text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE bal numeric;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  UPDATE public.profiles SET credits = credits + _amount WHERE id = _user_id RETURNING credits INTO bal;
  IF bal IS NULL THEN RAISE EXCEPTION 'user not found'; END IF;
  INSERT INTO public.credit_transactions (user_id, amount, reason, balance_after, metadata)
    VALUES (_user_id, _amount, coalesce(_reason,'admin_grant'), bal, jsonb_build_object('by', auth.uid()));
  RETURN jsonb_build_object('ok', true, 'balance', bal);
END $function$;

-- Popunder view now credits 0.1 per view (fractional Plug Credits).
CREATE OR REPLACE FUNCTION public.claim_popunder_view(_hold_ms integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  views_today int;
  last_view timestamptz;
  daily_cap int := 15;
  new_bal numeric;
  credit_amount numeric := 0.1;
  view_index int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _hold_ms IS NULL OR _hold_ms < 20000 THEN RAISE EXCEPTION 'HOLD_TOO_SHORT'; END IF;

  SELECT count(*)::int, max(created_at) INTO views_today, last_view
  FROM public.credit_transactions
  WHERE user_id = uid AND reason = 'popunder_view' AND created_at::date = current_date;

  IF views_today >= daily_cap THEN RAISE EXCEPTION 'DAILY_LIMIT_REACHED'; END IF;
  IF last_view IS NOT NULL AND last_view > now() - interval '15 seconds' THEN
    RAISE EXCEPTION 'TOO_FAST';
  END IF;

  view_index := views_today + 1;

  UPDATE public.profiles SET credits = credits + credit_amount
    WHERE id = uid RETURNING credits INTO new_bal;

  INSERT INTO public.credit_transactions (user_id, amount, reason, balance_after, metadata)
  VALUES (uid, credit_amount, 'popunder_view', new_bal,
    jsonb_build_object('view_index', view_index, 'hold_ms', _hold_ms));

  RETURN jsonb_build_object(
    'ok', true,
    'views_today', view_index,
    'daily_cap', daily_cap,
    'credits_added', credit_amount,
    'balance', new_bal
  );
END $function$;
