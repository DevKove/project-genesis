-- Preserve at least one administrator per association and make membership identity immutable.
-- These rules must be enforced in the database, not only by the member-management UI.

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

DROP TRIGGER IF EXISTS guard_association_membership ON public.association_members;
CREATE TRIGGER guard_association_membership
BEFORE UPDATE OR DELETE ON public.association_members
FOR EACH ROW EXECUTE FUNCTION private.guard_association_membership();
