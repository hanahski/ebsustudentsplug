
ALTER TABLE public.user_books ADD COLUMN IF NOT EXISTS share_token text UNIQUE;

-- SECURITY DEFINER read fn so anyone with a share link can preview a draft.
CREATE OR REPLACE FUNCTION public.get_book_by_share_token(_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE b public.user_books%ROWTYPE; chs jsonb;
BEGIN
  SELECT * INTO b FROM public.user_books WHERE share_token = _token;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id',c.id,'idx',c.idx,'title',c.title,'content',c.content) ORDER BY c.idx), '[]'::jsonb)
    INTO chs FROM public.user_book_chapters c WHERE c.book_id = b.id;
  RETURN jsonb_build_object(
    'id', b.id, 'title', b.title, 'subtitle', b.subtitle, 'description', b.description,
    'cover_url', b.cover_url, 'book_type', b.book_type, 'status', b.status,
    'chapters', chs
  );
END $$;

REVOKE ALL ON FUNCTION public.get_book_by_share_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_book_by_share_token(text) TO anon, authenticated;
