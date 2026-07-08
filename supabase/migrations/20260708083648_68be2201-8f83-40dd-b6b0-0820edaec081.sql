
-- Restrict sensitive profile columns from public/anon access
-- Revoke column-level SELECT on sensitive fields from anon (unauthenticated visitors)
REVOKE SELECT (email, payout_account, current_lat, current_lng, location_updated_at, jamb_number) ON public.profiles FROM anon;

-- Revoke financial/national-ID fields from authenticated users too;
-- owners can still read their own via public.get_my_profile() (SECURITY DEFINER)
REVOKE SELECT (payout_account, jamb_number) ON public.profiles FROM authenticated;

-- Ensure service_role retains full access
GRANT ALL ON public.profiles TO service_role;
