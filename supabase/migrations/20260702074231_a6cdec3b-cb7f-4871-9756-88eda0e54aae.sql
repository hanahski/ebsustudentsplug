
ALTER TABLE public.library_books
  ALTER COLUMN price_credits TYPE numeric(6,2) USING price_credits::numeric,
  ADD COLUMN IF NOT EXISTS download_formats jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.library_book_purchases
  ALTER COLUMN price_paid TYPE numeric(6,2) USING price_paid::numeric;

-- Backfill OpenStax rows with a formats map + correct price.
UPDATE public.library_books
SET price_credits = 0.7,
    download_formats = jsonb_strip_nulls(jsonb_build_object('pdf', download_url))
WHERE source = 'openstax';
