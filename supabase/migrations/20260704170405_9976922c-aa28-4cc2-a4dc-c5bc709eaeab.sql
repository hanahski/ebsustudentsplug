
-- 1) Hide market_listings.contact from anonymous users via column-level grants
REVOKE SELECT ON public.market_listings FROM anon;
GRANT SELECT (id, seller_id, title, description, price, category, listing_kind, photos, cover_url, is_sold, created_at, location, is_ai_generated, author, edition, course_code, condition, is_donation) ON public.market_listings TO anon;

-- 2) Tighten banner_events INSERT: authenticated only (removes always-true anon INSERT)
DROP POLICY IF EXISTS "Anyone can log banner events" ON public.banner_events;
CREATE POLICY "Authenticated can log banner events"
  ON public.banner_events FOR INSERT TO authenticated WITH CHECK (true);

-- 3) Revoke EXECUTE from anon (and PUBLIC) on privileged/admin SECURITY DEFINER functions
REVOKE EXECUTE ON FUNCTION public._agent_exec_sql(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_comment(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_listing(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_post(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_find_user(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_credits(uuid, integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_credits(uuid, numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_post_to_note(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_reset_jamb(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_badge(uuid, text, boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_rank(uuid, text, integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_set_user_status(uuid, text) FROM PUBLIC, anon;

-- User-authenticated-only actions
REVOKE EXECUTE ON FUNCTION public.buy_ticket(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_ad_reward(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_ad_reward(numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_jamb_number(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.claim_popunder_view(integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.publish_user_book(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.redeem_coupon(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.spend_credits(integer, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.spend_credits(numeric, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_grant_credits(uuid, integer, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_grant_credits(uuid, numeric, text) FROM authenticated;
-- (admin_* functions still callable by authenticated; internal is_admin() gate rejects non-admins)
GRANT EXECUTE ON FUNCTION public.admin_grant_credits(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_grant_credits(uuid, numeric, text) TO authenticated;

-- 4) Fix mutable search_path on generate_referral_code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
 RETURNS text
 LANGUAGE plpgsql
 SET search_path = public, extensions
AS $function$
DECLARE
  code text;
  tries int := 0;
BEGIN
  LOOP
    code := upper(substring(replace(encode(extensions.gen_random_bytes(6), 'base64'), '/', '') from 1 for 8));
    code := regexp_replace(code, '[^A-Z0-9]', '', 'g');
    IF length(code) >= 6 AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE referral_code = code) THEN
      RETURN code;
    END IF;
    tries := tries + 1;
    IF tries > 20 THEN
      RETURN upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    END IF;
  END LOOP;
END $function$;
