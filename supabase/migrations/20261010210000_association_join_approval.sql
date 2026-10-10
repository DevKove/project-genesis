-- Association membership approval workflow.
-- This migration is committed to the repository only; review and apply through the normal Supabase migration process.

CREATE TABLE public.association_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  association_name text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  requested_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  review_note text,
  CONSTRAINT association_join_requests_review_consistency CHECK (
    (status = 'pendente' AND reviewed_at IS NULL AND reviewed_by IS NULL)
    OR (status IN ('aprovado', 'rejeitado') AND reviewed_at IS NOT NULL AND reviewed_by IS NOT NULL)
  )
);

CREATE INDEX association_join_requests_association_status_idx
  ON public.association_join_requests (association_id, status, requested_at DESC);
CREATE INDEX association_join_requests_user_requested_idx
  ON public.association_join_requests (user_id, requested_at DESC);
CREATE UNIQUE INDEX association_join_requests_one_pending_per_user_idx
  ON public.association_join_requests (association_id, user_id)
  WHERE status = 'pendente';

ALTER TABLE public.association_join_requests ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.association_join_requests TO authenticated;
GRANT ALL ON public.association_join_requests TO service_role;

CREATE POLICY "Applicants and association admins read join requests"
  ON public.association_join_requests
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR private.has_assoc_role(
      association_id,
      (SELECT auth.uid()),
      ARRAY['admin']::public.assoc_role[]
    )
  );

-- Public signup gets only the minimum association directory fields.
CREATE OR REPLACE FUNCTION public.list_associations_for_signup()
RETURNS TABLE (id uuid, name text, city text, state text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT a.id, a.name, a.city, a.state
  FROM public.associations AS a
  WHERE a.status = 'ativa'
  ORDER BY a.name;
$function$;

REVOKE EXECUTE ON FUNCTION public.list_associations_for_signup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_associations_for_signup() TO anon, authenticated;

-- Create a request only; never grant membership based on user-editable metadata.
CREATE OR REPLACE FUNCTION public.create_association_join_request_for_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  requested_association uuid;
  association_name text;
  applicant_name text;
  applicant_email text;
BEGIN
  IF COALESCE(NEW.raw_user_meta_data ->> 'association_id', '') !~
     '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RETURN NEW;
  END IF;

  requested_association := (NEW.raw_user_meta_data ->> 'association_id')::uuid;
  SELECT a.name INTO association_name
  FROM public.associations AS a
  WHERE a.id = requested_association AND a.status = 'ativa';

  IF association_name IS NULL THEN
    RETURN NEW;
  END IF;

  applicant_name := pg_catalog.left(
    pg_catalog.btrim(COALESCE(NEW.raw_user_meta_data ->> 'full_name', '')),
    160
  );
  applicant_email := pg_catalog.lower(pg_catalog.btrim(COALESCE(NEW.email, '')));

  IF applicant_name = '' OR applicant_email = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.association_join_requests
    (association_id, association_name, user_id, full_name, email)
  VALUES
    (requested_association, association_name, NEW.id, applicant_name, applicant_email)
  ON CONFLICT (association_id, user_id) WHERE status = 'pendente'
  DO NOTHING;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.create_association_join_request_for_new_user() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS create_association_join_request_after_signup ON auth.users;
CREATE TRIGGER create_association_join_request_after_signup
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_association_join_request_for_new_user();

-- Approval/rejection is atomic and can only be performed by an administrator of that association.
CREATE OR REPLACE FUNCTION public.review_association_join_request(
  _request_id uuid,
  _decision text,
  _note text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  request_row public.association_join_requests;
  reviewer uuid := auth.uid();
  normalized_note text := NULLIF(pg_catalog.left(pg_catalog.btrim(COALESCE(_note, '')), 500), '');
BEGIN
  IF reviewer IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;
  IF _decision NOT IN ('aprovado', 'rejeitado') THEN
    RAISE EXCEPTION 'Decisão inválida' USING ERRCODE = '22023';
  END IF;

  SELECT r.* INTO request_row
  FROM public.association_join_requests AS r
  WHERE r.id = _request_id
  FOR UPDATE;

  IF request_row.id IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada' USING ERRCODE = 'P0002';
  END IF;
  IF NOT private.has_assoc_role(
    request_row.association_id,
    reviewer,
    ARRAY['admin']::public.assoc_role[]
  ) THEN
    RAISE EXCEPTION 'Somente o administrador da associação pode revisar solicitações'
      USING ERRCODE = '42501';
  END IF;
  IF request_row.status <> 'pendente' THEN
    RAISE EXCEPTION 'Esta solicitação já foi analisada' USING ERRCODE = '22023';
  END IF;

  IF _decision = 'aprovado' THEN
    INSERT INTO public.association_members (association_id, user_id, role)
    VALUES (request_row.association_id, request_row.user_id, 'morador')
    ON CONFLICT (association_id, user_id) DO NOTHING;
  END IF;

  UPDATE public.association_join_requests
  SET status = _decision,
      reviewed_at = pg_catalog.now(),
      reviewed_by = reviewer,
      review_note = normalized_note
  WHERE id = request_row.id;

  RETURN _decision;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.review_association_join_request(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_association_join_request(uuid, text, text) TO authenticated;
