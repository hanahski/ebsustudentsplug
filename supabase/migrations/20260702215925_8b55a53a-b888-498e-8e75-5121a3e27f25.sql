
-- 1. JAMB column on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS jamb_number text;

-- 2. Global uniqueness (case-insensitive), only for non-null values
CREATE UNIQUE INDEX IF NOT EXISTS profiles_jamb_number_unique
  ON public.profiles (upper(jamb_number))
  WHERE jamb_number IS NOT NULL;

-- 3. Lock trigger: once set it cannot be changed or cleared (except by admin function which bypasses via SECURITY DEFINER + session var)
CREATE OR REPLACE FUNCTION public.lock_jamb_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.jamb_number IS NOT NULL
     AND NEW.jamb_number IS DISTINCT FROM OLD.jamb_number
     AND coalesce(current_setting('app.allow_jamb_change', true), '') <> 'on' THEN
    RAISE EXCEPTION 'JAMB number cannot be changed once set';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS profiles_lock_jamb ON public.profiles;
CREATE TRIGGER profiles_lock_jamb
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.lock_jamb_number();

-- 4. Public availability view (only exposes whether a JAMB is taken, not who owns it)
CREATE OR REPLACE VIEW public.jamb_availability AS
  SELECT upper(jamb_number) AS jamb
  FROM public.profiles
  WHERE jamb_number IS NOT NULL;

GRANT SELECT ON public.jamb_availability TO anon, authenticated;

-- 5. Admin reset function
CREATE OR REPLACE FUNCTION public.admin_reset_jamb(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  PERFORM set_config('app.allow_jamb_change', 'on', true);
  UPDATE public.profiles SET jamb_number = NULL WHERE id = _user_id;
  PERFORM set_config('app.allow_jamb_change', 'off', true);
END $$;

-- 6. Claim function (called by signed-in user after signup)
CREATE OR REPLACE FUNCTION public.claim_jamb_number(_jamb text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE uid uuid := auth.uid(); norm text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'auth required'; END IF;
  norm := upper(regexp_replace(coalesce(_jamb,''), '\s+', '', 'g'));
  IF norm !~ '^[0-9]{8}[A-Z]{2}$' THEN
    RAISE EXCEPTION 'invalid JAMB format (expected 8 digits + 2 letters)';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE upper(jamb_number) = norm AND id <> uid) THEN
    RAISE EXCEPTION 'JAMB number already registered to another account';
  END IF;
  UPDATE public.profiles SET jamb_number = norm WHERE id = uid AND jamb_number IS NULL;
  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE id = uid AND jamb_number IS NOT NULL) THEN
      RAISE EXCEPTION 'JAMB already set for this account';
    END IF;
    RAISE EXCEPTION 'profile not found';
  END IF;
  RETURN jsonb_build_object('ok', true, 'jamb', norm);
END $$;

-- 7. Platform settings: seed news_api_key row if missing (value blank until admin sets it)
INSERT INTO public.platform_settings (key, value)
  SELECT 'news_api_key', ''
  WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings WHERE key = 'news_api_key');
