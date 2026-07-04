
DROP POLICY IF EXISTS "Public read tickets" ON storage.objects;

CREATE POLICY "Ticket files owner-only read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'tickets'
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR auth.uid()::text = (storage.foldername(name))[1]
      OR EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE (t.buyer_id = auth.uid() OR t.uploader_id = auth.uid())
          AND (name LIKE '%' || t.id::text || '%')
      )
    )
  );
