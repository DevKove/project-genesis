-- Ensure pending/rejected accounts cannot bypass the UI by calling RPCs or
-- reaching association data through an existing membership.

CREATE OR REPLACE FUNCTION private.has_role(
  _user_id uuid,
  _role public.app_role
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT COALESCE(_user_id = (SELECT auth.uid()), false)
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = _user_id
        AND p.account_status = 'approved'
    )
    AND EXISTS (
      SELECT 1
      FROM public.user_roles r
      WHERE r.user_id = _user_id
        AND r.role = _role
    );
$function$;

CREATE OR REPLACE FUNCTION private.has_assoc_role(
  _assoc uuid,
  _user uuid,
  _roles public.assoc_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT COALESCE(_user = (SELECT auth.uid()), false)
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = _user
        AND p.account_status = 'approved'
    )
    AND EXISTS (
      SELECT 1
      FROM public.association_members m
      WHERE m.association_id = _assoc
        AND m.user_id = _user
        AND m.role = ANY(_roles)
    );
$function$;

CREATE OR REPLACE FUNCTION private.is_member(
  _assoc uuid,
  _user uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT COALESCE(_user = (SELECT auth.uid()), false)
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = _user
        AND p.account_status = 'approved'
    )
    AND EXISTS (
      SELECT 1
      FROM public.association_members m
      WHERE m.association_id = _assoc
        AND m.user_id = _user
    );
$function$;

CREATE OR REPLACE FUNCTION public.create_association(
  _name text,
  _cnpj text DEFAULT NULL,
  _city text DEFAULT NULL,
  _state text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  new_id uuid;
  normalized_name text;
  normalized_cnpj text;
  normalized_city text;
  normalized_state text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.account_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'O cadastro precisa ser aprovado antes de criar uma associação'
      USING ERRCODE = '42501';
  END IF;

  normalized_name := pg_catalog.btrim(coalesce(_name, ''));
  IF pg_catalog.char_length(normalized_name) < 3
     OR pg_catalog.char_length(normalized_name) > 120 THEN
    RAISE EXCEPTION 'Nome da associação inválido' USING ERRCODE = '22023';
  END IF;

  normalized_cnpj := nullif(pg_catalog.upper(pg_catalog.btrim(coalesce(_cnpj, ''))), '');
  IF normalized_cnpj IS NOT NULL AND NOT private.is_valid_cnpj(normalized_cnpj) THEN
    RAISE EXCEPTION 'CNPJ inválido' USING ERRCODE = '22023';
  END IF;

  normalized_city := nullif(pg_catalog.btrim(coalesce(_city, '')), '');
  IF normalized_city IS NOT NULL AND (
    pg_catalog.char_length(normalized_city) < 1
    OR pg_catalog.char_length(normalized_city) > 120
  ) THEN
    RAISE EXCEPTION 'Cidade inválida' USING ERRCODE = '22023';
  END IF;

  normalized_state := nullif(pg_catalog.upper(pg_catalog.btrim(coalesce(_state, ''))), '');
  IF normalized_state IS NOT NULL AND normalized_state !~ '^[A-Z]{2}$' THEN
    RAISE EXCEPTION 'UF inválida' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.associations (name, cnpj, city, state, created_by)
  VALUES (normalized_name, normalized_cnpj, normalized_city, normalized_state, auth.uid())
  RETURNING id INTO new_id;

  INSERT INTO public.association_members (association_id, user_id, role)
  VALUES (new_id, auth.uid(), 'admin');

  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_invitation(_token uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  inv public.invitations;
  user_email text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.account_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'O cadastro precisa ser aprovado antes de aceitar convites'
      USING ERRCODE = '42501';
  END IF;

  SELECT u.email INTO user_email
  FROM auth.users AS u
  WHERE u.id = auth.uid();

  IF user_email IS NULL THEN
    RAISE EXCEPTION 'A conta precisa ter um e-mail para aceitar este convite'
      USING ERRCODE = '28000';
  END IF;

  SELECT i.* INTO inv
  FROM public.invitations AS i
  WHERE i.token = _token
  FOR UPDATE;

  IF inv.id IS NULL THEN
    RAISE EXCEPTION 'Convite não encontrado' USING ERRCODE = '22023';
  END IF;
  IF inv.status <> 'pendente' THEN
    RAISE EXCEPTION 'Convite já utilizado ou cancelado' USING ERRCODE = '22023';
  END IF;
  IF inv.expires_at <= pg_catalog.now() THEN
    RAISE EXCEPTION 'Convite expirado' USING ERRCODE = '22023';
  END IF;
  IF pg_catalog.lower(inv.email) IS DISTINCT FROM pg_catalog.lower(user_email) THEN
    RAISE EXCEPTION 'Este convite foi enviado para outro e-mail' USING ERRCODE = '28000';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.association_members AS m
    WHERE m.association_id = inv.association_id
      AND m.user_id = inv.invited_by
      AND m.role IN ('admin', 'presidente', 'secretario')
  ) THEN
    RAISE EXCEPTION 'O convite não é mais válido' USING ERRCODE = '28000';
  END IF;

  IF inv.role NOT IN ('morador', 'funcionario', 'conselheiro')
     AND NOT EXISTS (
       SELECT 1
       FROM public.association_members AS m
       WHERE m.association_id = inv.association_id
         AND m.user_id = inv.invited_by
         AND m.role = 'admin'
     ) THEN
    RAISE EXCEPTION 'Somente um administrador pode conceder papéis de liderança'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.association_members (association_id, user_id, role)
  VALUES (inv.association_id, auth.uid(), inv.role)
  ON CONFLICT (association_id, user_id) DO NOTHING;

  UPDATE public.invitations
  SET status = 'aceito'
  WHERE id = inv.id AND status = 'pendente';

  UPDATE public.residents
  SET user_id = auth.uid()
  WHERE association_id = inv.association_id
    AND pg_catalog.lower(email) = pg_catalog.lower(user_email)
    AND user_id IS NULL;

  RETURN inv.association_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_association(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_association(text, text, text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_invitation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid) TO authenticated;
