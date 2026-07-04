
CREATE OR REPLACE FUNCTION public.claim_popunder_view(_hold_ms integer)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  views_today int;
  last_view timestamptz;
  daily_cap int := 15;
  new_bal int;
  credit_amount int;
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
  credit_amount := CASE WHEN view_index % 2 = 0 THEN 1 ELSE 0 END;

  IF credit_amount > 0 THEN
    UPDATE public.profiles SET credits = credits + credit_amount
      WHERE id = uid RETURNING credits INTO new_bal;
  ELSE
    SELECT credits INTO new_bal FROM public.profiles WHERE id = uid;
  END IF;

  INSERT INTO public.credit_transactions (user_id, amount, reason, balance_after, metadata)
  VALUES (uid, credit_amount, 'popunder_view', new_bal,
    jsonb_build_object('view_index', view_index, 'hold_ms', _hold_ms, 'half_credit_view', true));

  RETURN jsonb_build_object(
    'ok', true,
    'views_today', view_index,
    'daily_cap', daily_cap,
    'credits_added', credit_amount,
    'balance', new_bal,
    'pending_half', credit_amount = 0
  );
END $$;

GRANT EXECUTE ON FUNCTION public.claim_popunder_view(integer) TO authenticated;
