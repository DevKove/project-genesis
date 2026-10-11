-- Enforce account approval and one administrator per scope.
-- Existing profiles stay approved; only newly registered accounts are pending.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'approved'
    CHECK (account_status IN ('pending', 'approved', 'rejected')),
  ADD COLUMN IF NOT EXISTS approval_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

CREATE TABLE IF NOT EXISTS public.account_access_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  requested_association_id uuid REFERENCES public.associations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_note text
);
ALTER TABLE public.account_access_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_access_requests FROM anon, authenticated;
GRANT SELECT ON public.account_access_requests TO authenticated;
GRANT ALL ON public.account_access_requests TO service_role;
DROP POLICY IF EXISTS "platform admin reads account requests" ON public.account_access_requests;
CREATE POLICY "platform admin reads account requests"
  ON public.account_access_requests FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'platform_admin'));

-- Registration always starts pending. User metadata is used only for display/request
-- context; it never grants roles or permissions.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  requested_assoc uuid;
  display_name text;
BEGIN
  display_name := NULLIF(pg_catalog.btrim(COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    ''
  )), '');

  BEGIN
    requested_assoc := NULLIF(NEW.raw_user_meta_data->>'association_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    requested_assoc := NULL;
  END;

  IF requested_assoc IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.associations a WHERE a.id = requested_assoc
  ) THEN
    requested_assoc := NULL;
  END IF;

  INSERT INTO public.profiles (id, full_name, account_status, approval_requested_at)
  VALUES (NEW.id, display_name, 'pending', pg_catalog.now())
  ON CONFLICT (id) DO UPDATE
    SET account_status = 'pending',
        approval_requested_at = COALESCE(public.profiles.approval_requested_at, pg_catalog.now());

  INSERT INTO public.account_access_requests (user_id, email, full_name, requested_association_id)
  VALUES (NEW.id, COALESCE(NEW.email, ''), display_name, requested_assoc)
  ON CONFLICT (user_id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        requested_association_id = EXCLUDED.requested_association_id,
        status = 'pending',
        requested_at = pg_catalog.now(),
        reviewed_at = NULL,
        reviewed_by = NULL,
        review_note = NULL;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Prevent users from changing their own approval state through the profiles API.
CREATE OR REPLACE FUNCTION private.guard_profile_approval_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NEW.account_status IS DISTINCT FROM OLD.account_status
     OR NEW.approval_requested_at IS DISTINCT FROM OLD.approval_requested_at
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason THEN
    IF NOT public.has_role((SELECT auth.uid()), 'platform_admin')
       AND COALESCE(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Somente a administração pode alterar o estado de aprovação da conta'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION private.guard_profile_approval_fields() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS guard_profile_approval_fields ON public.profiles;
CREATE TRIGGER guard_profile_approval_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION private.guard_profile_approval_fields();

-- A single platform administrator and a single association administrator per association.
-- Index creation intentionally fails rather than silently demoting an existing administrator.
CREATE UNIQUE INDEX IF NOT EXISTS one_platform_admin_only
  ON public.user_roles (role)
  WHERE role = 'platform_admin'::public.app_role;
CREATE UNIQUE INDEX IF NOT EXISTS one_admin_per_association
  ON public.association_members (association_id)
  WHERE role = 'admin'::public.assoc_role;

-- Only the existing platform administrator can approve/reject accounts and assign
-- an association profile. All decisions are performed atomically in the database.
CREATE OR REPLACE FUNCTION public.review_account_access(
  _user_id uuid,
  _decision text,
  _association_id uuid DEFAULT NULL,
  _association_role public.assoc_role DEFAULT 'morador',
  _note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  request_row public.account_access_requests;
  normalized_note text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role((SELECT auth.uid()), 'platform_admin') THEN
    RAISE EXCEPTION 'Somente o administrador principal pode revisar cadastros'
      USING ERRCODE = '42501';
  END IF;

  IF _decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Decisão inválida' USING ERRCODE = '22023';
  END IF;

  SELECT r.* INTO request_row
  FROM public.account_access_requests r
  WHERE r.user_id = _user_id
  FOR UPDATE;

  IF request_row.user_id IS NULL THEN
    RAISE EXCEPTION 'Solicitação de acesso não encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF request_row.status <> 'pending' THEN
    RAISE EXCEPTION 'Esta solicitação já foi analisada' USING ERRCODE = '22023';
  END IF;

  normalized_note := NULLIF(pg_catalog.left(pg_catalog.btrim(COALESCE(_note, '')), 500), '');

  IF _decision = 'approved' AND _association_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.associations a WHERE a.id = _association_id) THEN
      RAISE EXCEPTION 'Associação não encontrada' USING ERRCODE = '22023';
    END IF;

    -- Elevated leadership roles are not assignable through public signup.
    -- The sole platform administrator may assign only the role selected here.
    INSERT INTO public.association_members (association_id, user_id, role)
    VALUES (_association_id, _user_id, COALESCE(_association_role, 'morador'))
    ON CONFLICT (association_id, user_id) DO UPDATE
      SET role = EXCLUDED.role;
  END IF;

  UPDATE public.account_access_requests
  SET status = _decision,
      reviewed_at = pg_catalog.now(),
      reviewed_by = auth.uid(),
      review_note = normalized_note
  WHERE user_id = _user_id;

  UPDATE public.profiles
  SET account_status = _decision,
      approved_at = CASE WHEN _decision = 'approved' THEN pg_catalog.now() ELSE NULL END,
      approved_by = auth.uid(),
      rejection_reason = CASE WHEN _decision = 'rejected' THEN normalized_note ELSE NULL END
  WHERE id = _user_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.review_account_access(uuid, text, uuid, public.assoc_role, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_account_access(uuid, text, uuid, public.assoc_role, text) TO authenticated;
