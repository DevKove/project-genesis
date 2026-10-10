-- Phase 1 security hardening for exposed SECURITY DEFINER helpers.
-- Keep helper functions usable by authenticated RLS policies, but prevent
-- callers from probing membership/role state for arbitrary user IDs.
-- Trigger functions are invoked by PostgreSQL triggers, not as RPC endpoints.

CREATE OR REPLACE FUNCTION public.has_assoc_role(
  _assoc uuid,
  _user uuid,
  _roles public.assoc_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(_user = (SELECT auth.uid()), false)
    AND EXISTS (
      SELECT 1
      FROM public.association_members
      WHERE association_id = _assoc
        AND user_id = _user
        AND role = ANY(_roles)
    );
$function$;

CREATE OR REPLACE FUNCTION public.has_role(
  _user_id uuid,
  _role public.app_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(_user_id = (SELECT auth.uid()), false)
    AND EXISTS (
      SELECT 1
      FROM public.user_roles
      WHERE user_id = _user_id
        AND role = _role
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_assoc_manager(
  _assoc uuid,
  _user uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.has_assoc_role(
    _assoc,
    _user,
    ARRAY['admin', 'presidente', 'secretario', 'tesoureiro']::public.assoc_role[]
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_member(
  _assoc uuid,
  _user uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(_user = (SELECT auth.uid()), false)
    AND EXISTS (
      SELECT 1
      FROM public.association_members
      WHERE association_id = _assoc
        AND user_id = _user
    );
$function$;

-- SECURITY DEFINER trigger functions are not public RPCs. PostgreSQL checks
-- function execution privileges when a trigger is created; existing triggers
-- continue to execute after these grants are removed.
REVOKE EXECUTE ON FUNCTION public.audit_trigger() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- These helpers are referenced by RLS policies, so authenticated must retain
-- EXECUTE. They now return no positive result for another user's ID.
REVOKE EXECUTE ON FUNCTION public.has_assoc_role(uuid, uuid, public.assoc_role[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_assoc_role(uuid, uuid, public.assoc_role[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_assoc_manager(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_assoc_manager(uuid, uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_member(uuid, uuid) TO authenticated;


-- Invitation role hierarchy: only association admins may grant the admin role
-- or invite other leadership roles. Presidents/secretaries can invite ordinary
-- residents, staff, and councillors, but cannot promote invitees to leadership.
DROP POLICY IF EXISTS "admins create invitations" ON public.invitations;
CREATE POLICY "admins create invitations" ON public.invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = (SELECT auth.uid())
    AND public.has_assoc_role(
      association_id,
      (SELECT auth.uid()),
      ARRAY['admin', 'presidente', 'secretario']::public.assoc_role[]
    )
    AND (
      public.has_assoc_role(association_id, (SELECT auth.uid()), ARRAY['admin']::public.assoc_role[])
      OR role = ANY(ARRAY['morador', 'funcionario', 'conselheiro']::public.assoc_role[])
    )
  );

DROP POLICY IF EXISTS "admins update invitations" ON public.invitations;
CREATE POLICY "admins update invitations" ON public.invitations
  FOR UPDATE TO authenticated
  USING (
    public.has_assoc_role(
      association_id,
      (SELECT auth.uid()),
      ARRAY['admin', 'presidente', 'secretario']::public.assoc_role[]
    )
  )
  WITH CHECK (
    public.has_assoc_role(
      association_id,
      (SELECT auth.uid()),
      ARRAY['admin', 'presidente', 'secretario']::public.assoc_role[]
    )
    AND (
      public.has_assoc_role(association_id, (SELECT auth.uid()), ARRAY['admin']::public.assoc_role[])
      OR role = ANY(ARRAY['morador', 'funcionario', 'conselheiro']::public.assoc_role[])
    )
  );

-- Serialize invitation acceptance and revalidate the inviter's current authority.
-- This also prevents old pending invitations from preserving a role after the
-- inviter has been removed/demoted.
CREATE OR REPLACE FUNCTION public.accept_invitation(_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  inv public.invitations;
  user_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT email INTO user_email
  FROM auth.users
  WHERE id = auth.uid();

  SELECT * INTO inv
  FROM public.invitations
  WHERE token = _token
  FOR UPDATE;

  IF inv.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado';
  END IF;
  IF inv.status <> 'pendente' THEN
    RAISE EXCEPTION 'Convite já utilizado ou cancelado';
  END IF;
  IF inv.expires_at < now() THEN
    RAISE EXCEPTION 'Convite expirado';
  END IF;
  IF lower(inv.email) <> lower(user_email) THEN
    RAISE EXCEPTION 'Este convite foi enviado para outro e-mail';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.association_members m
    WHERE m.association_id = inv.association_id
      AND m.user_id = inv.invited_by
      AND m.role IN ('admin', 'presidente', 'secretario')
  ) THEN
    RAISE EXCEPTION 'O convite não é mais válido';
  END IF;

  IF inv.role = 'admin' AND NOT EXISTS (
    SELECT 1
    FROM public.association_members m
    WHERE m.association_id = inv.association_id
      AND m.user_id = inv.invited_by
      AND m.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Somente um administrador pode conceder o papel de administrador';
  END IF;

  INSERT INTO public.association_members (association_id, user_id, role)
  VALUES (inv.association_id, auth.uid(), inv.role)
  ON CONFLICT (association_id, user_id)
  DO UPDATE SET role = EXCLUDED.role;

  UPDATE public.invitations
  SET status = 'aceito'
  WHERE id = inv.id AND status = 'pendente';

  UPDATE public.residents
  SET user_id = auth.uid()
  WHERE association_id = inv.association_id
    AND lower(email) = lower(user_email)
    AND user_id IS NULL;

  RETURN inv.association_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.accept_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid) TO authenticated;
