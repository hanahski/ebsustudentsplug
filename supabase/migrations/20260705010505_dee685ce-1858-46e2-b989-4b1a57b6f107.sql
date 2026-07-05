
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_dm_thread_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_book_by_share_token(text) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.ensure_referral_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.seed_admin_email_matches_current_user(uuid) TO authenticated;

GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_comment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_listing(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_post(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_find_user(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_post_to_note(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_reset_jamb(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_badge(uuid, text, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_rank(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_user_status(uuid, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.buy_ticket(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ad_reward(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ad_reward(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_jamb_number(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_popunder_view(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_user_book(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_coupon(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_credits(integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.spend_credits(numeric, text) TO authenticated;
