-- Apply via Backend → SQL editor.
-- Verified Sources + Approval Flow for EBSU News.

-- profiles: source verification flags
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_verified_source boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_trusted_source boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_name text;

-- news_articles: submission/review fields
ALTER TABLE public.news_articles
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE INDEX IF NOT EXISTS news_articles_submitted_by_idx
  ON public.news_articles (submitted_by, status);
CREATE INDEX IF NOT EXISTS news_articles_pending_idx
  ON public.news_articles (created_at DESC) WHERE status = 'pending';

-- Submitters can read their own submissions in any status.
DROP POLICY IF EXISTS "Submitters can read own news submissions" ON public.news_articles;
CREATE POLICY "Submitters can read own news submissions"
  ON public.news_articles FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());

-- Verified sources can insert EBSU news as pending under their own identity.
DROP POLICY IF EXISTS "Verified sources can submit news" ON public.news_articles;
CREATE POLICY "Verified sources can submit news"
  ON public.news_articles FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    AND category = 'ebsu'
    AND status = 'pending'
    AND EXISTS (SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_verified_source = true)
  );

-- Trigger: trusted sources auto-publish on insert.
CREATE OR REPLACE FUNCTION public.news_articles_trusted_autopublish()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'pending' AND NEW.submitted_by IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.profiles
      WHERE id = NEW.submitted_by AND is_trusted_source = true) THEN
      NEW.status := 'published';
      NEW.published_at := COALESCE(NEW.published_at, now());
      NEW.reviewed_by := NEW.submitted_by;
      NEW.reviewed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS news_articles_trusted_autopublish_trg ON public.news_articles;
CREATE TRIGGER news_articles_trusted_autopublish_trg
  BEFORE INSERT ON public.news_articles
  FOR EACH ROW EXECUTE FUNCTION public.news_articles_trusted_autopublish();

-- Admin RPCs
CREATE OR REPLACE FUNCTION public.admin_set_source_flags(
  _user_id uuid, _is_verified_source boolean, _is_trusted_source boolean, _source_name text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  UPDATE public.profiles
    SET is_verified_source = COALESCE(_is_verified_source, is_verified_source),
        is_trusted_source  = COALESCE(_is_trusted_source, is_trusted_source),
        source_name        = CASE WHEN _source_name IS NULL THEN source_name
                                  ELSE NULLIF(trim(_source_name), '') END
    WHERE id = _user_id;
END $$;

CREATE OR REPLACE FUNCTION public.admin_review_submission(
  _article_id uuid, _decision text, _reason text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'admin only'; END IF;
  IF _decision NOT IN ('approve','reject') THEN RAISE EXCEPTION 'bad decision'; END IF;
  IF _decision = 'approve' THEN
    UPDATE public.news_articles
      SET status = 'published',
          published_at = COALESCE(published_at, now()),
          reviewed_by = auth.uid(),
          reviewed_at = now(),
          rejection_reason = NULL
      WHERE id = _article_id;
  ELSE
    UPDATE public.news_articles
      SET status = 'rejected',
          reviewed_by = auth.uid(),
          reviewed_at = now(),
          rejection_reason = NULLIF(trim(coalesce(_reason,'')), '')
      WHERE id = _article_id;
  END IF;
END $$;
