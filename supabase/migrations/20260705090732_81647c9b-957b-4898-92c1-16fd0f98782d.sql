
-- 1. Normalize existing admin display names
UPDATE public.profiles
SET display_name = 'Admin'
WHERE id IN (SELECT user_id FROM public.user_roles WHERE role = 'admin');

-- 2. Trigger: force admin profiles to always display as "Admin"
CREATE OR REPLACE FUNCTION public.force_admin_display_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.has_role(NEW.id, 'admin'::public.app_role) THEN
    NEW.display_name := 'Admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_force_admin_display_name ON public.profiles;
CREATE TRIGGER trg_force_admin_display_name
BEFORE INSERT OR UPDATE OF display_name ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.force_admin_display_name();

-- 3. When a user is newly granted admin role, mask their existing profile name
CREATE OR REPLACE FUNCTION public.mask_new_admin_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'admin'::public.app_role THEN
    UPDATE public.profiles SET display_name = 'Admin' WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mask_new_admin_name ON public.user_roles;
CREATE TRIGGER trg_mask_new_admin_name
AFTER INSERT ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.mask_new_admin_name();
