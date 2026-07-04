
-- 1. bank_account_resolutions: admin-only read
DROP POLICY IF EXISTS "authed read resolutions" ON public.bank_account_resolutions;
CREATE POLICY "Admins read bank resolutions" ON public.bank_account_resolutions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. profiles: restrict sensitive columns via GRANTs
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, display_name, avatar_key, cover_url, department_id, bio,
  rank_tier, rank_step, approved_post_count, show_online, seen_welcome,
  is_verified, status, referral_code, created_at, updated_at, last_seen_at,
  cover_video_url, academic_level, is_star, is_legit, is_sure_plug, picture_url
) ON public.profiles TO anon, authenticated;
GRANT SELECT ON public.profiles TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM public.profiles WHERE id = auth.uid(); $$;
REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- 3. quizzes: writes scoped to owner/admin
DROP POLICY IF EXISTS "qz auth" ON public.quizzes;
CREATE POLICY "qz insert own" ON public.quizzes
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "qz update own or admin" ON public.quizzes
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role));
CREATE POLICY "qz delete own or admin" ON public.quizzes
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role));

-- 4. quiz_questions: writes require owning the parent quiz
DROP POLICY IF EXISTS "qq auth" ON public.quiz_questions;
CREATE POLICY "qq insert if owns quiz" ON public.quiz_questions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND (q.created_by = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role))));
CREATE POLICY "qq update if owns quiz" ON public.quiz_questions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND (q.created_by = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND (q.created_by = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role))));
CREATE POLICY "qq delete if owns quiz" ON public.quiz_questions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.quizzes q WHERE q.id = quiz_id AND (q.created_by = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role))));

-- 5. tickets: hide qr_token via column grants
REVOKE SELECT ON public.tickets FROM anon, authenticated;
GRANT SELECT (
  id, uploader_id, title, description, photo_url, price, pay_mode, contact, is_sold, buyer_id, created_at
) ON public.tickets TO anon, authenticated;
GRANT SELECT ON public.tickets TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_ticket_qr(_ticket_id uuid)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT qr_token FROM public.tickets
  WHERE id = _ticket_id
    AND (buyer_id = auth.uid() OR uploader_id = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role));
$$;
REVOKE ALL ON FUNCTION public.get_my_ticket_qr(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_ticket_qr(uuid) TO authenticated;

-- 6. Storage write policies (owner-folder pattern + admin catch-all)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='user_upload_own_folder_v1') THEN
    CREATE POLICY user_upload_own_folder_v1 ON storage.objects
      FOR INSERT TO authenticated
      WITH CHECK (
        bucket_id IN ('avatars','banners','blog-images','book-covers','book-pdfs','covers','post-files','post-images','post-media','tickets')
        AND auth.uid()::text = (storage.foldername(name))[1]
      );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='user_update_own_folder_v1') THEN
    CREATE POLICY user_update_own_folder_v1 ON storage.objects
      FOR UPDATE TO authenticated
      USING (auth.uid()::text = (storage.foldername(name))[1])
      WITH CHECK (auth.uid()::text = (storage.foldername(name))[1]);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='user_delete_own_folder_v1') THEN
    CREATE POLICY user_delete_own_folder_v1 ON storage.objects
      FOR DELETE TO authenticated
      USING (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(),'admin'::public.app_role));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname='admin_manage_all_objects_v1') THEN
    CREATE POLICY admin_manage_all_objects_v1 ON storage.objects
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'admin'::public.app_role))
      WITH CHECK (public.has_role(auth.uid(),'admin'::public.app_role));
  END IF;
END $$;

-- 7. coupons: remove auth-wide listing (redemption stays via redeem_coupon RPC)
DROP POLICY IF EXISTS "auth read active coupons" ON public.coupons;

-- 8. note_views: SELECT scoped to viewer/admin
DROP POLICY IF EXISTS "nv read" ON public.note_views;
CREATE POLICY "nv read own" ON public.note_views
  FOR SELECT TO authenticated USING (viewer_id = auth.uid() OR public.has_role(auth.uid(),'admin'::public.app_role));
