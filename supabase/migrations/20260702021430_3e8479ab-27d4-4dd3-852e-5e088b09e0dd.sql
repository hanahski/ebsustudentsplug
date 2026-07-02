
-- Admin-managed integration settings (Paystack, Mux, etc.).
-- Values are secrets; only service_role reads/writes. Admin server functions gate access.
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key text PRIMARY KEY,
  value text,
  is_secret boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
-- Deliberately no anon/authenticated policies. All reads go through server fns w/ service role.

-- Paystack account resolutions cache (avoid hammering Paystack when user retypes)
CREATE TABLE IF NOT EXISTS public.bank_account_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_number text NOT NULL,
  bank_code text NOT NULL,
  bank_name text NOT NULL,
  account_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_number, bank_code)
);
GRANT SELECT, INSERT ON public.bank_account_resolutions TO authenticated;
GRANT ALL ON public.bank_account_resolutions TO service_role;
ALTER TABLE public.bank_account_resolutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authed read resolutions" ON public.bank_account_resolutions
  FOR SELECT TO authenticated USING (true);

-- Mux fields on banner_slides
ALTER TABLE public.banner_slides
  ADD COLUMN IF NOT EXISTS mux_asset_id text,
  ADD COLUMN IF NOT EXISTS mux_playback_id text,
  ADD COLUMN IF NOT EXISTS mux_status text;
