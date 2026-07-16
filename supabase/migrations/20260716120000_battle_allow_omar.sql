-- Allow "Omar" as a valid fighter pick alongside Subzero and Kano.
CREATE OR REPLACE FUNCTION public.battle_mk_pick(_match_id uuid, _character text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  m public.battle_matches%ROWTYPE;
  a_bal numeric; b_bal numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _character NOT IN ('Subzero','Kano','Omar') THEN RAISE EXCEPTION 'bad character'; END IF;
  SELECT * INTO m FROM public.battle_matches WHERE id = _match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match not found'; END IF;
  IF m.game_type <> 'mk' THEN RAISE EXCEPTION 'wrong game type'; END IF;
  IF m.status <> 'coin_flip' THEN RAISE EXCEPTION 'not in select stage'; END IF;
  IF uid <> m.player_a AND uid <> m.player_b THEN RAISE EXCEPTION 'not a player'; END IF;

  IF uid = m.player_a THEN
    IF m.a_character IS NOT NULL THEN RAISE EXCEPTION 'already picked'; END IF;
    IF m.b_character = _character THEN RAISE EXCEPTION 'character taken'; END IF;
    UPDATE public.battle_matches SET a_character = _character, last_activity_at = now() WHERE id = _match_id;
    m.a_character := _character;
  ELSE
    IF m.b_character IS NOT NULL THEN RAISE EXCEPTION 'already picked'; END IF;
    IF m.a_character = _character THEN RAISE EXCEPTION 'character taken'; END IF;
    UPDATE public.battle_matches SET b_character = _character, last_activity_at = now() WHERE id = _match_id;
    m.b_character := _character;
  END IF;

  IF m.a_character IS NOT NULL AND m.b_character IS NOT NULL THEN
    SELECT credits INTO a_bal FROM public.profiles WHERE id = m.player_a FOR UPDATE;
    SELECT credits INTO b_bal FROM public.profiles WHERE id = m.player_b FOR UPDATE;
    IF (a_bal < m.stake AND NOT public.is_admin(m.player_a))
       OR (b_bal < m.stake AND NOT public.is_admin(m.player_b)) THEN
      UPDATE public.battle_matches SET status='cancelled', last_activity_at=now() WHERE id=_match_id;
      RAISE EXCEPTION 'INSUFFICIENT_CREDITS_ONE_PLAYER';
    END IF;
    IF NOT public.is_admin(m.player_a) THEN
      UPDATE public.profiles SET credits = credits - m.stake WHERE id = m.player_a;
      INSERT INTO public.credit_transactions (user_id, amount, reason, metadata, balance_after)
        VALUES (m.player_a, -m.stake, 'battle_stake', jsonb_build_object('match_id', m.id, 'game','mk'), a_bal - m.stake);
    END IF;
    IF NOT public.is_admin(m.player_b) THEN
      UPDATE public.profiles SET credits = credits - m.stake WHERE id = m.player_b;
      INSERT INTO public.credit_transactions (user_id, amount, reason, metadata, balance_after)
        VALUES (m.player_b, -m.stake, 'battle_stake', jsonb_build_object('match_id', m.id, 'game','mk'), b_bal - m.stake);
    END IF;
    UPDATE public.battle_matches
      SET status='active', started_at=now(), escrowed=true, last_activity_at=now()
      WHERE id=_match_id;
    RETURN jsonb_build_object('ok', true, 'started', true);
  END IF;
  RETURN jsonb_build_object('ok', true, 'waiting', true);
END $function$;
