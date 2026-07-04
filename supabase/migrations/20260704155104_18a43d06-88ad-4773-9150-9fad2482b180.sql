-- Storage RLS policies for user upload buckets used by book covers, post media, and post files.
-- Root cause of "new row violates row-level security policy" when uploading covers.

-- book-covers: users manage files under their own user-id folder; public read (bucket is public).
CREATE POLICY "book-covers public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'book-covers');

CREATE POLICY "book-covers authenticated write own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'book-covers'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "book-covers authenticated update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'book-covers' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'book-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "book-covers authenticated delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'book-covers' AND auth.uid()::text = (storage.foldername(name))[1]);

-- post-media: public read; owners manage their folder.
CREATE POLICY "post-media public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'post-media');

CREATE POLICY "post-media authenticated write own"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'post-media'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "post-media authenticated update own"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "post-media authenticated delete own"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'post-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- post-files: private bucket. Owners read/write their own folder only.
CREATE POLICY "post-files owner read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'post-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "post-files owner write"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'post-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "post-files owner update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'post-files' AND auth.uid()::text = (storage.foldername(name))[1])
  WITH CHECK (bucket_id = 'post-files' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "post-files owner delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'post-files' AND auth.uid()::text = (storage.foldername(name))[1]);