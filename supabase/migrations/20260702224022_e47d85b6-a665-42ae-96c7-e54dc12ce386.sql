
-- Auto-generate referral_code for profiles
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  code text;
  tries int := 0;
BEGIN
  LOOP
    code := upper(substring(replace(encode(extensions.gen_random_bytes(6), 'base64'), '/', '') from 1 for 8));
    code := regexp_replace(code, '[^A-Z0-9]', '', 'g');
    IF length(code) >= 6 AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = code) THEN
      RETURN code;
    END IF;
    tries := tries + 1;
    IF tries > 20 THEN
      RETURN upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.ensure_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL OR NEW.referral_code = '' THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_ensure_referral_code ON public.profiles;
CREATE TRIGGER trg_ensure_referral_code
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.ensure_referral_code();

-- Backfill existing profiles
UPDATE public.profiles
SET referral_code = public.generate_referral_code()
WHERE referral_code IS NULL OR referral_code = '';
