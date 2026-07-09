-- Re-allow anonymous banner impression/click logging.
DROP POLICY IF EXISTS "Anyone can log banner events" ON public.banner_events;
CREATE POLICY "Anyone can log banner events"
  ON public.banner_events FOR INSERT TO anon WITH CHECK (kind IN ('impression','click'));

-- Per-banner rotation seconds so admins can set how long each slide shows
-- before the carousel swaps to the next one (2-30 seconds).
ALTER TABLE public.banner_slides
  ADD COLUMN IF NOT EXISTS rotation_seconds integer NOT NULL DEFAULT 6;

CREATE OR REPLACE FUNCTION public.banner_slides_rotation_validate()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.rotation_seconds IS NULL OR NEW.rotation_seconds < 2 OR NEW.rotation_seconds > 30 THEN
    RAISE EXCEPTION 'rotation_seconds must be between 2 and 30';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS banner_slides_rotation_validate_tg ON public.banner_slides;
CREATE TRIGGER banner_slides_rotation_validate_tg
  BEFORE INSERT OR UPDATE OF rotation_seconds ON public.banner_slides
  FOR EACH ROW EXECUTE FUNCTION public.banner_slides_rotation_validate();