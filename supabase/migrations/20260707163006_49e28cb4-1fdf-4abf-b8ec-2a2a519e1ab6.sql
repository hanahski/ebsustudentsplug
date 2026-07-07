
-- ============ TABLES ============
CREATE TYPE public.battle_status AS ENUM ('pending','coin_flip','active','finished','cancelled','declined');

CREATE TABLE public.battle_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_b uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  stake integer NOT NULL DEFAULT 10,
  status public.battle_status NOT NULL DEFAULT 'pending',
  mode text NOT NULL DEFAULT 'random', -- 'random' | 'challenge'
  a_choice text,  -- 'heads' | 'tails'
  b_choice text,
  coin_result text,
  first_player uuid,
  current_turn uuid,
  board jsonb NOT NULL DEFAULT '[null,null,null,null,null,null,null,null,null]'::jsonb,
  moves_count integer NOT NULL DEFAULT 0,
  winner uuid,
  is_draw boolean NOT NULL DEFAULT false,
  device_hash_a text,
  device_hash_b text,
  escrowed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  finished_at timestamptz,
  last_activity_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX battle_matches_player_a_idx ON public.battle_matches(player_a);
CREATE INDEX battle_matches_player_b_idx ON public.battle_matches(player_b);
CREATE INDEX battle_matches_status_idx ON public.battle_matches(status);

GRANT SELECT, INSERT, UPDATE ON public.battle_matches TO authenticated;
GRANT ALL ON public.battle_matches TO service_role;

ALTER TABLE public.battle_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players view their matches" ON public.battle_matches
  FOR SELECT TO authenticated
  USING (auth.uid() = player_a OR auth.uid() = player_b OR (status = 'pending' AND mode = 'random' AND player_b IS NULL));

-- All mutations happen through SECURITY DEFINER functions; no direct writes.

CREATE TABLE public.battle_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  opponent_id uuid NOT NULL,
  reason text NOT NULL,
  wins integer NOT NULL DEFAULT 0,
  total integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.battle_flags TO authenticated;
GRANT ALL ON public.battle_flags TO service_role;
ALTER TABLE public.battle_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view flags" ON public.battle_flags FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Realtime
ALTER TABLE public.battle_matches REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_matches;

-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public._battle_check_win(_board jsonb, _uid uuid)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  lines int[][] := ARRAY[
    ARRAY[0,1,2],ARRAY[3,4,5],ARRAY[6,7,8],
    ARRAY[0,3,6],ARRAY[1,4,7],ARRAY[2,5,8],
    ARRAY[0,4,8],ARRAY[2,4,6]
  ];
  ln int[];
  v text := _uid::text;
BEGIN
  FOREACH ln SLICE 1 IN ARRAY lines LOOP
    IF (_board->>ln[1]) = v AND (_board->>ln[2]) = v AND (_board->>ln[3]) = v THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END $$;

-- ============ MATCHMAKE (random) ============
CREATE OR REPLACE FUNCTION public.battle_matchmake(_device_hash text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  bal numeric;
  m_id uuid;
  stake_amt int := 10;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;

  SELECT credits INTO bal FROM public.profiles WHERE id = uid;
  IF bal < stake_amt AND NOT public.is_admin(uid) THEN RAISE EXCEPTION 'INSUFFICIENT_CREDITS'; END IF;

  -- Cancel my own stale pending matches
  UPDATE public.battle_matches SET status = 'cancelled'
    WHERE player_a = uid AND status = 'pending' AND created_at < now() - interval '2 minutes';

  -- Try to find an existing waiting match from a different user & device,
  -- avoiding opponents I've played >=3 times in last 24h (soft: prefer others).
  SELECT id INTO m_id
  FROM public.battle_matches m
  WHERE m.status = 'pending'
    AND m.mode = 'random'
    AND m.player_b IS NULL
    AND m.player_a <> uid
    AND (m.device_hash_a IS NULL OR _device_hash IS NULL OR m.device_hash_a <> _device_hash)
    AND m.created_at > now() - interval '2 minutes'
    AND NOT EXISTS (
      SELECT 1 FROM public.battle_matches x
      WHERE x.status = 'finished'
        AND x.finished_at > now() - interval '24 hours'
        AND ((x.player_a = uid AND x.player_b = m.player_a) OR (x.player_b = uid AND x.player_a = m.player_a))
      GROUP BY 1 HAVING count(*) >= 3
    )
  ORDER BY m.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF m_id IS NULL THEN
    -- No suitable opponent; loosen the "avoid repeats" filter
    SELECT id INTO m_id
    FROM public.battle_matches m
    WHERE m.status = 'pending' AND m.mode = 'random' AND m.player_b IS NULL
      AND m.player_a <> uid
      AND (m.device_hash_a IS NULL OR _device_hash IS NULL OR m.device_hash_a <> _device_hash)
      AND m.created_at > now() - interval '2 minutes'
    ORDER BY m.created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED;
  END IF;

  IF m_id IS NOT NULL THEN
    UPDATE public.battle_matches
      SET player_b = uid, status = 'coin_flip', device_hash_b = _device_hash, last_activity_at = now()
      WHERE id = m_id;
    RETURN m_id;
  END IF;

  INSERT INTO public.battle_matches (player_a, stake, mode, device_hash_a)
    VALUES (uid, stake_amt, 'random', _device_hash)
    RETURNING id INTO m_id;
  RETURN m_id;
END $$;

-- ============ DIRECT CHALLENGE ============
CREATE OR REPLACE FUNCTION public.battle_challenge(_opponent uuid, _device_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); m_id uuid; bal numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF uid = _opponent THEN RAISE EXCEPTION 'cannot challenge yourself'; END IF;
  SELECT credits INTO bal FROM public.profiles WHERE id = uid;
  IF bal < 10 AND NOT public.is_admin(uid) THEN RAISE EXCEPTION 'INSUFFICIENT_CREDITS'; END IF;

  INSERT INTO public.battle_matches (player_a, player_b, stake, mode, device_hash_a, status)
    VALUES (uid, _opponent, 10, 'challenge', _device_hash, 'pending')
    RETURNING id INTO m_id;
  RETURN m_id;
END $$;

CREATE OR REPLACE FUNCTION public.battle_respond(_match_id uuid, _accept boolean, _device_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); m public.battle_matches%ROWTYPE; bal numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO m FROM public.battle_matches WHERE id = _match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match not found'; END IF;
  IF m.player_b <> uid THEN RAISE EXCEPTION 'not the invited player'; END IF;
  IF m.status <> 'pending' THEN RAISE EXCEPTION 'match not pending'; END IF;

  IF NOT _accept THEN
    UPDATE public.battle_matches SET status = 'declined', last_activity_at = now() WHERE id = _match_id;
    RETURN;
  END IF;

  SELECT credits INTO bal FROM public.profiles WHERE id = uid;
  IF bal < m.stake AND NOT public.is_admin(uid) THEN RAISE EXCEPTION 'INSUFFICIENT_CREDITS'; END IF;

  UPDATE public.battle_matches
    SET status = 'coin_flip', device_hash_b = _device_hash, last_activity_at = now()
    WHERE id = _match_id;
END $$;

-- ============ COIN FLIP ============
CREATE OR REPLACE FUNCTION public.battle_pick_side(_match_id uuid, _choice text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  m public.battle_matches%ROWTYPE;
  a_bal numeric; b_bal numeric;
  coin text;
  winner_of_toss uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _choice NOT IN ('heads','tails') THEN RAISE EXCEPTION 'bad choice'; END IF;
  SELECT * INTO m FROM public.battle_matches WHERE id = _match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match not found'; END IF;
  IF m.status <> 'coin_flip' THEN RAISE EXCEPTION 'not in coin flip stage'; END IF;
  IF uid <> m.player_a AND uid <> m.player_b THEN RAISE EXCEPTION 'not a player'; END IF;

  IF uid = m.player_a THEN
    IF m.a_choice IS NOT NULL THEN RAISE EXCEPTION 'already picked'; END IF;
    -- opponent must not have picked the same side
    IF m.b_choice = _choice THEN RAISE EXCEPTION 'side already taken'; END IF;
    UPDATE public.battle_matches SET a_choice = _choice, last_activity_at = now() WHERE id = _match_id;
    m.a_choice := _choice;
  ELSE
    IF m.b_choice IS NOT NULL THEN RAISE EXCEPTION 'already picked'; END IF;
    IF m.a_choice = _choice THEN RAISE EXCEPTION 'side already taken'; END IF;
    UPDATE public.battle_matches SET b_choice = _choice, last_activity_at = now() WHERE id = _match_id;
    m.b_choice := _choice;
  END IF;

  -- If both picked, or one picked and other auto-gets remaining side, flip when both have a side
  IF m.a_choice IS NOT NULL AND m.b_choice IS NULL THEN
    UPDATE public.battle_matches SET b_choice = CASE WHEN m.a_choice = 'heads' THEN 'tails' ELSE 'heads' END WHERE id = _match_id;
    m.b_choice := CASE WHEN m.a_choice = 'heads' THEN 'tails' ELSE 'heads' END;
  ELSIF m.b_choice IS NOT NULL AND m.a_choice IS NULL THEN
    -- (unreachable via above branch but kept symmetric)
    UPDATE public.battle_matches SET a_choice = CASE WHEN m.b_choice = 'heads' THEN 'tails' ELSE 'heads' END WHERE id = _match_id;
    m.a_choice := CASE WHEN m.b_choice = 'heads' THEN 'tails' ELSE 'heads' END;
  END IF;

  IF m.a_choice IS NOT NULL AND m.b_choice IS NOT NULL THEN
    coin := CASE WHEN random() < 0.5 THEN 'heads' ELSE 'tails' END;
    IF m.a_choice = coin THEN winner_of_toss := m.player_a; ELSE winner_of_toss := m.player_b; END IF;

    -- Escrow stakes now
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
        VALUES (m.player_a, -m.stake, 'battle_stake', jsonb_build_object('match_id', m.id), a_bal - m.stake);
    END IF;
    IF NOT public.is_admin(m.player_b) THEN
      UPDATE public.profiles SET credits = credits - m.stake WHERE id = m.player_b;
      INSERT INTO public.credit_transactions (user_id, amount, reason, metadata, balance_after)
        VALUES (m.player_b, -m.stake, 'battle_stake', jsonb_build_object('match_id', m.id), b_bal - m.stake);
    END IF;

    UPDATE public.battle_matches
      SET status='active', coin_result=coin, first_player=winner_of_toss, current_turn=winner_of_toss,
          started_at=now(), escrowed=true, last_activity_at=now()
      WHERE id=_match_id;

    RETURN jsonb_build_object('ok', true, 'coin', coin, 'first_player', winner_of_toss);
  END IF;

  RETURN jsonb_build_object('ok', true, 'waiting', true);
END $$;

-- ============ MAKE MOVE ============
CREATE OR REPLACE FUNCTION public.battle_move(_match_id uuid, _cell integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  m public.battle_matches%ROWTYPE;
  new_board jsonb;
  opponent uuid;
  won boolean;
  drew boolean := false;
  pot int;
  loser_bal numeric; winner_bal numeric;
  wins_vs int; total_vs int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  IF _cell < 0 OR _cell > 8 THEN RAISE EXCEPTION 'bad cell'; END IF;

  SELECT * INTO m FROM public.battle_matches WHERE id = _match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match not found'; END IF;
  IF m.status <> 'active' THEN RAISE EXCEPTION 'match not active'; END IF;
  IF m.current_turn <> uid THEN RAISE EXCEPTION 'not your turn'; END IF;
  IF (m.board->>_cell) IS NOT NULL THEN RAISE EXCEPTION 'cell taken'; END IF;

  new_board := jsonb_set(m.board, ARRAY[_cell::text], to_jsonb(uid::text));
  opponent := CASE WHEN uid = m.player_a THEN m.player_b ELSE m.player_a END;
  won := public._battle_check_win(new_board, uid);
  IF NOT won AND (m.moves_count + 1) >= 9 THEN drew := true; END IF;

  IF won OR drew THEN
    pot := m.stake * 2;
    IF won THEN
      SELECT credits INTO winner_bal FROM public.profiles WHERE id = uid FOR UPDATE;
      UPDATE public.profiles SET credits = credits + pot WHERE id = uid;
      INSERT INTO public.credit_transactions (user_id, amount, reason, metadata, balance_after)
        VALUES (uid, pot, 'battle_win', jsonb_build_object('match_id', m.id, 'opponent', opponent), winner_bal + pot);
      UPDATE public.battle_matches
        SET board=new_board, moves_count=moves_count+1, winner=uid, status='finished',
            finished_at=now(), last_activity_at=now()
        WHERE id=_match_id;

      -- Anti-cheat: flag if wins >70% vs same opponent (min 5 games)
      SELECT
        count(*) FILTER (WHERE winner = uid),
        count(*)
      INTO wins_vs, total_vs
      FROM public.battle_matches
      WHERE status='finished'
        AND ((player_a = uid AND player_b = opponent) OR (player_b = uid AND player_a = opponent));
      IF total_vs >= 5 AND (wins_vs::float / total_vs) > 0.7 THEN
        INSERT INTO public.battle_flags (user_id, opponent_id, reason, wins, total)
          VALUES (uid, opponent, 'suspicious_win_rate', wins_vs, total_vs);
      END IF;
    ELSE
      -- Draw: refund both
      IF NOT public.is_admin(m.player_a) THEN
        SELECT credits INTO winner_bal FROM public.profiles WHERE id = m.player_a FOR UPDATE;
        UPDATE public.profiles SET credits = credits + m.stake WHERE id = m.player_a;
        INSERT INTO public.credit_transactions (user_id, amount, reason, metadata, balance_after)
          VALUES (m.player_a, m.stake, 'battle_refund', jsonb_build_object('match_id', m.id), winner_bal + m.stake);
      END IF;
      IF NOT public.is_admin(m.player_b) THEN
        SELECT credits INTO winner_bal FROM public.profiles WHERE id = m.player_b FOR UPDATE;
        UPDATE public.profiles SET credits = credits + m.stake WHERE id = m.player_b;
        INSERT INTO public.credit_transactions (user_id, amount, reason, metadata, balance_after)
          VALUES (m.player_b, m.stake, 'battle_refund', jsonb_build_object('match_id', m.id), winner_bal + m.stake);
      END IF;
      UPDATE public.battle_matches
        SET board=new_board, moves_count=moves_count+1, is_draw=true, status='finished',
            finished_at=now(), last_activity_at=now()
        WHERE id=_match_id;
    END IF;
    RETURN jsonb_build_object('ok', true, 'finished', true, 'won', won, 'draw', drew);
  END IF;

  UPDATE public.battle_matches
    SET board=new_board, moves_count=moves_count+1, current_turn=opponent, last_activity_at=now()
    WHERE id=_match_id;
  RETURN jsonb_build_object('ok', true, 'finished', false);
END $$;

-- Cancel (only allowed pre-active)
CREATE OR REPLACE FUNCTION public.battle_cancel(_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); m public.battle_matches%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  SELECT * INTO m FROM public.battle_matches WHERE id=_match_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF m.status IN ('active','finished','cancelled','declined') THEN RETURN; END IF;
  IF uid <> m.player_a AND uid <> m.player_b THEN RAISE EXCEPTION 'not a player'; END IF;
  UPDATE public.battle_matches SET status='cancelled', last_activity_at=now() WHERE id=_match_id;
END $$;

GRANT EXECUTE ON FUNCTION public.battle_matchmake(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.battle_challenge(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.battle_respond(uuid, boolean, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.battle_pick_side(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.battle_move(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.battle_cancel(uuid) TO authenticated;
