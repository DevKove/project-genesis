
DROP FUNCTION IF EXISTS public.admin_list_user_profiles();

CREATE FUNCTION public.admin_list_user_profiles()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  phone text,
  avatar_url text,
  account_status text,
  platform_role text,
  created_at timestamptz,
  memberships jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF NOT private.has_role((SELECT auth.uid()), 'platform_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Somente o administrador principal pode consultar todos os perfis'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT p.id,
         u.email::text,
         p.full_name,
         p.phone,
         p.avatar_url,
         p.account_status,
         COALESCE((
           SELECT pg_catalog.string_agg(ur.role::text, ', ')
           FROM public.user_roles ur
           WHERE ur.user_id = p.id
         ), 'usuário') AS platform_role,
         p.created_at,
         COALESCE((
           SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
             'association_id', m.association_id,
             'association_name', a.name,
             'role', m.role::text
           ) ORDER BY a.name)
           FROM public.association_members m
           JOIN public.associations a ON a.id = m.association_id
           WHERE m.user_id = p.id
         ), '[]'::jsonb) AS memberships
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  ORDER BY p.created_at DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_update_association_member_role(
  _user_id uuid,
  _association_id uuid,
  _new_role text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_role public.assoc_role;
BEGIN
  IF NOT private.has_role((SELECT auth.uid()), 'platform_admin'::public.app_role) THEN
    RAISE EXCEPTION 'Somente o administrador principal pode alterar tipos de perfil'
      USING ERRCODE = '42501';
  END IF;

  IF _user_id IS NULL OR _association_id IS NULL THEN
    RAISE EXCEPTION 'Usuário e associação são obrigatórios'
      USING ERRCODE = '22023';
  END IF;

  BEGIN
    v_role := _new_role::public.assoc_role;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'Tipo de perfil inválido'
      USING ERRCODE = '22023';
  END;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = _user_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.associations WHERE id = _association_id) THEN
    RAISE EXCEPTION 'Associação não encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.association_members
    WHERE user_id = _user_id AND association_id = _association_id
  ) THEN
    RAISE EXCEPTION 'O usuário não possui vínculo com esta associação'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_role = 'admin'::public.assoc_role AND EXISTS (
    SELECT 1 FROM public.association_members
    WHERE association_id = _association_id
      AND role = 'admin'::public.assoc_role
      AND user_id <> _user_id
  ) THEN
    RAISE EXCEPTION 'Esta associação já possui um administrador. Transfira a administração antes de promover outro usuário.'
      USING ERRCODE = '23505';
  END IF;

  UPDATE public.association_members
  SET role = v_role
  WHERE user_id = _user_id AND association_id = _association_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.admin_list_user_profiles() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_association_member_role(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_user_profiles() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_update_association_member_role(uuid, uuid, text) TO authenticated, service_role;
