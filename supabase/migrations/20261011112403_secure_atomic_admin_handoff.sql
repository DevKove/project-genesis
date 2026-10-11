
CREATE TABLE IF NOT EXISTS private.association_admin_handoffs (
  transaction_id bigint NOT NULL,
  association_id uuid NOT NULL,
  PRIMARY KEY (transaction_id, association_id)
);

REVOKE ALL ON TABLE private.association_admin_handoffs FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION private.guard_association_membership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  other_admin_count integer;
  controlled_handoff boolean := false;
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

      SELECT EXISTS (
        SELECT 1 FROM private.association_admin_handoffs h
        WHERE h.transaction_id = pg_catalog.txid_current()
          AND h.association_id = OLD.association_id
      ) INTO controlled_handoff;

      SELECT pg_catalog.count(*) INTO other_admin_count
      FROM public.association_members AS m
      WHERE m.association_id = OLD.association_id
        AND m.role = 'admin'::public.assoc_role
        AND m.user_id <> OLD.user_id;

      IF other_admin_count = 0 AND NOT controlled_handoff THEN
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

      SELECT EXISTS (
        SELECT 1 FROM private.association_admin_handoffs h
        WHERE h.transaction_id = pg_catalog.txid_current()
          AND h.association_id = OLD.association_id
      ) INTO controlled_handoff;

      SELECT pg_catalog.count(*) INTO other_admin_count
      FROM public.association_members AS m
      WHERE m.association_id = OLD.association_id
        AND m.role = 'admin'::public.assoc_role
        AND m.user_id <> OLD.user_id;

      IF other_admin_count = 0 AND NOT controlled_handoff THEN
        RAISE EXCEPTION 'A associação precisa manter pelo menos um administrador'
          USING ERRCODE = '42501';
      END IF;
    END IF;

    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$function$;

