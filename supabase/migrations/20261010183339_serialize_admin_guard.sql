-- Serialize administrator demotion/deletion checks per association.
-- The association row lock prevents two concurrent transactions from both
-- observing another admin and removing the last two admins simultaneously.

CREATE OR REPLACE FUNCTION private.guard_association_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  other_admin_count integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.association_id IS DISTINCT FROM OLD.association_id
       OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'A associação e o usuário de um vínculo não podem ser alterados; remova e convide novamente'
        USING ERRCODE = '42501';
    END IF;

    IF OLD.role = 'admin'::public.assoc_role
       AND NEW.role IS DISTINCT FROM OLD.role THEN
      PERFORM 1
      FROM public.associations AS a
      WHERE a.id = OLD.association_id
      FOR UPDATE;

      SELECT pg_catalog.count(*) INTO other_admin_count
      FROM public.association_members AS m
      WHERE m.association_id = OLD.association_id
        AND m.role = 'admin'::public.assoc_role
        AND m.user_id <> OLD.user_id;

      IF other_admin_count = 0 THEN
        RAISE EXCEPTION 'A associação precisa manter pelo menos um administrador'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.role = 'admin'::public.assoc_role THEN
      PERFORM 1
      FROM public.associations AS a
      WHERE a.id = OLD.association_id
      FOR UPDATE;

      SELECT pg_catalog.count(*) INTO other_admin_count
      FROM public.association_members AS m
      WHERE m.association_id = OLD.association_id
        AND m.role = 'admin'::public.assoc_role
        AND m.user_id <> OLD.user_id;

      IF other_admin_count = 0 THEN
        RAISE EXCEPTION 'A associação precisa manter pelo menos um administrador'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION private.guard_association_membership() FROM PUBLIC, anon, authenticated;
