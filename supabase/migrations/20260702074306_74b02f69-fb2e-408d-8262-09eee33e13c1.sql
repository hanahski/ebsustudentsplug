
ALTER TABLE public.profiles
  ALTER COLUMN credits TYPE numeric(12,2) USING credits::numeric;

ALTER TABLE public.credit_transactions
  ALTER COLUMN amount TYPE numeric(12,2) USING amount::numeric,
  ALTER COLUMN balance_after TYPE numeric(12,2) USING balance_after::numeric;
