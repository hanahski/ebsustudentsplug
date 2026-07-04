
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_dm_thread_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ensure_referral_code() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_book_by_share_token(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.seed_admin_email_matches_current_user(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.auto_grant_admin_for_seed_email() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.banner_slides_validate() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lock_jamb_number() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
