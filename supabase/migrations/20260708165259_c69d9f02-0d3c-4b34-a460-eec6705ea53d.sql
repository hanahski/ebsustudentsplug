
ALTER TABLE public.battle_matches
  ADD COLUMN IF NOT EXISTS game_type text NOT NULL DEFAULT 'tictactoe',
  ADD COLUMN IF NOT EXISTS a_character text,
  ADD COLUMN IF NOT EXISTS b_character text;

CREATE INDEX IF NOT EXISTS battle_matches_pending_by_game
  ON public.battle_matches (game_type, status, created_at)
  WHERE status = 'pending';

-- Extend matchmaking with game_type
CREATE OR REPLACE FUNCTION public.battle_matchmake(_device_hash text, _game_type text DEFAULT 'tictactoe')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  bal numeric;
  m_id uuid;
  stake_amt int := 10;
  gt text := COALESCE(_game_type, 'tictactoe');
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF gt NOT IN ('tictactoe','mk') THEN RAISE EXCEPTION 'bad game_type'; END IF;

  SELECT credits INTO bal FROM public.profiles WHERE id = uid;
  IF bal < stake_amt AND NOT public.is_admin(uid) THEN RAISE EXCEPTION 'INSUFFICIENT_CREDITS'; END IF;

  UPDATE public.battle_matches SET status = 'cancelled'
    WHERE player_a = uid AND status = 'pending' AND created_at < now() - interval '2 minutes';

  SELECT id INTO m_id
  FROM public.battle_matches m
  WHERE m.status = 'pending'
    AND m.mode = 'random'
    AND m.game_type = gt
    AND m.player_b IS NULL
    AND m.player_a <> uid
    AND (m.device_hash_a IS NULL OR _device_hash IS NULL OR m.device_hash_a <> _device_hash)
    AND m.created_at > now() - interval '2 minutes'
  ORDER BY m.created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;

  IF m_id IS NOT NULL THEN
    UPDATE public.battle_matches
      SET player_b = uid, status = 'coin_flip', device_hash_b = _device_hash, last_activity_at = now()
      WHERE id = m_id;
    RETURN m_id;
  END IF;

  INSERT INTO public.battle_matches (player_a, stake, mode, device_hash_a, game_type)
    VALUES (uid, stake_amt, 'random', _device_hash, gt)
    RETURNING id INTO m_id;
  RETURN m_id;
END $function$;

-- Fighter character pick + escrow when both picked
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
  IF _character NOT IN ('Subzero','Kano') THEN RAISE EXCEPTION 'bad character'; END IF;
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

-- Report fighter match result (idempotent, either player can call)
CREATE OR REPLACE FUNCTION public.battle_mk_finish(_match_id uuid, _winner uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  m public.battle_matches%ROWTYPE;
  pot int;
  bal numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO m FROM public.battle_matches WHERE id = _match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match not found'; END IF;
  IF m.game_type <> 'mk' THEN RAISE EXCEPTION 'wrong game type'; END IF;
  IF m.status = 'finished' THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;
  IF m.status <> 'active' THEN RAISE EXCEPTION 'not active'; END IF;
  IF uid <> m.player_a AND uid <> m.player_b THEN RAISE EXCEPTION 'not a player'; END IF;
  IF _winner IS NOT NULL AND _winner <> m.player_a AND _winner <> m.player_b THEN
    RAISE EXCEPTION 'bad winner';
  END IF;

  pot := m.stake * 2;
  IF _winner IS NULL THEN
    -- draw refund
    IF NOT public.is_admin(m.player_a) THEN
      SELECT credits INTO bal FROM public.profiles WHERE id = m.player_a FOR UPDATE;
      UPDATE public.profiles SET credits = credits + m.stake WHERE id = m.player_a;
      INSERT INTO public.credit_transactions (user_id, amount, reason, metadata, balance_after)
        VALUES (m.player_a, m.stake, 'battle_refund', jsonb_build_object('match_id', m.id, 'game','mk'), bal + m.stake);
    END IF;
    IF NOT public.is_admin(m.player_b) THEN
      SELECT credits INTO bal FROM public.profiles WHERE id = m.player_b FOR UPDATE;
      UPDATE public.profiles SET credits = credits + m.stake WHERE id = m.player_b;
      INSERT INTO public.credit_transactions (user_id, amount, reason, metadata, balance_after)
        VALUES (m.player_b, m.stake, 'battle_refund', jsonb_build_object('match_id', m.id, 'game','mk'), bal + m.stake);
    END IF;
    UPDATE public.battle_matches SET status='finished', is_draw=true, finished_at=now(), last_activity_at=now()
      WHERE id=_match_id;
  ELSE
    SELECT credits INTO bal FROM public.profiles WHERE id = _winner FOR UPDATE;
    UPDATE public.profiles SET credits = credits + pot WHERE id = _winner;
    INSERT INTO public.credit_transactions (user_id, amount, reason, metadata, balance_after)
      VALUES (_winner, pot, 'battle_win', jsonb_build_object('match_id', m.id, 'game','mk'), bal + pot);
    UPDATE public.battle_matches SET status='finished', winner=_winner, finished_at=now(), last_activity_at=now()
      WHERE id=_match_id;
  END IF;
  RETURN jsonb_build_object('ok', true);
END $function$;
