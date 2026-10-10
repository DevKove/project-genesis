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

CREATE TABLE public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  association_id uuid REFERENCES public.associations(id) ON DELETE CASCADE,
  request_id uuid REFERENCES public.association_join_requests(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('solicitacao_membro', 'solicitacao_aprovada', 'solicitacao_recusada')),
  title text NOT NULL,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);

CREATE INDEX user_notifications_recipient_created_idx
  ON public.user_notifications (recipient_id, created_at DESC);
CREATE INDEX user_notifications_unread_idx
  ON public.user_notifications (recipient_id, created_at DESC)
  WHERE read_at IS NULL;

ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, UPDATE ON public.user_notifications TO authenticated;
GRANT ALL ON public.user_notifications TO service_role;

CREATE POLICY "Users read own notifications"
  ON public.user_notifications FOR SELECT TO authenticated
  USING (recipient_id = (SELECT auth.uid()));
CREATE POLICY "Users mark own notifications read"
  ON public.user_notifications FOR UPDATE TO authenticated
  USING (recipient_id = (SELECT auth.uid()))
  WITH CHECK (recipient_id = (SELECT auth.uid()));

-- Create durable in-app notifications for every admin of the requested association.
CREATE OR REPLACE FUNCTION public.notify_admins_of_join_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  INSERT INTO public.user_notifications
    (recipient_id, association_id, request_id, notification_type, title, message)
  SELECT m.user_id, NEW.association_id, NEW.id, 'solicitacao_membro',
         'Novo pedido de acesso',
         NEW.full_name || ' solicitou acesso à associação ' || NEW.association_name || '.'
  FROM public.association_members AS m
  WHERE m.association_id = NEW.association_id AND m.role = 'admin';

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.notify_admins_of_join_request() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS notify_admins_after_join_request ON public.association_join_requests;
CREATE TRIGGER notify_admins_after_join_request
  AFTER INSERT ON public.association_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_of_join_request();

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
  selected_association_name text;
  applicant_name text;
  applicant_email text;
BEGIN
  IF COALESCE(NEW.raw_user_meta_data ->> 'association_id', '') !~
     '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RETURN NEW;
  END IF;

  requested_association := (NEW.raw_user_meta_data ->> 'association_id')::uuid;
  SELECT a.name INTO selected_association_name
  FROM public.associations AS a
  WHERE a.id = requested_association AND a.status = 'ativa';

  IF selected_association_name IS NULL THEN
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
    (requested_association, selected_association_name, NEW.id, applicant_name, applicant_email)
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

-- Allow OAuth-created accounts to request access after authentication, without granting membership.
CREATE OR REPLACE FUNCTION public.request_association_membership(_association_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  requester uuid := auth.uid();
  applicant_email text;
  applicant_name text;
  selected_association_name text;
BEGIN
  IF requester IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '28000';
  END IF;

  SELECT pg_catalog.lower(pg_catalog.btrim(COALESCE(u.email, ''))),
         pg_catalog.left(
           COALESCE(
             NULLIF(pg_catalog.btrim(u.raw_user_meta_data ->> 'full_name'), ''),
             pg_catalog.split_part(COALESCE(u.email, 'Membro'), '@', 1)
           ),
           160
         )
  INTO applicant_email, applicant_name
  FROM auth.users AS u
  WHERE u.id = requester;

  IF applicant_email IS NULL OR applicant_email = '' THEN
    RAISE EXCEPTION 'A conta precisa ter um e-mail válido' USING ERRCODE = '28000';
  END IF;

  SELECT a.name INTO selected_association_name
  FROM public.associations AS a
  WHERE a.id = _association_id AND a.status = 'ativa';

  IF selected_association_name IS NULL THEN
    RAISE EXCEPTION 'Associação não encontrada ou inativa' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.association_members AS m
    WHERE m.association_id = _association_id AND m.user_id = requester
  ) THEN
    RETURN 'membro';
  END IF;

  INSERT INTO public.association_join_requests
    (association_id, association_name, user_id, full_name, email)
  VALUES
    (_association_id, selected_association_name, requester, applicant_name, applicant_email)
  ON CONFLICT (association_id, user_id) WHERE status = 'pendente'
  DO NOTHING;

  RETURN 'pendente';
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.request_association_membership(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_association_membership(uuid) TO authenticated;

-- Notify the applicant after the administrator has made a decision.
CREATE OR REPLACE FUNCTION public.notify_applicant_of_join_request_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
BEGIN
  IF OLD.status = 'pendente' AND NEW.status IN ('aprovado', 'rejeitado') THEN
    INSERT INTO public.user_notifications
      (recipient_id, association_id, request_id, notification_type, title, message)
    VALUES (
      NEW.user_id,
      NEW.association_id,
      NEW.id,
      CASE WHEN NEW.status = 'aprovado' THEN 'solicitacao_aprovada' ELSE 'solicitacao_recusada' END,
      CASE WHEN NEW.status = 'aprovado' THEN 'Acesso aprovado' ELSE 'Solicitação recusada' END,
      CASE WHEN NEW.status = 'aprovado'
        THEN 'Seu acesso à associação ' || NEW.association_name || ' foi aprovado.'
        ELSE 'Sua solicitação de acesso à associação ' || NEW.association_name || ' não foi aprovada.'
      END
    );
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.notify_applicant_of_join_request_review() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS notify_applicant_after_join_request_review ON public.association_join_requests;
CREATE TRIGGER notify_applicant_after_join_request_review
  AFTER UPDATE OF status ON public.association_join_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_applicant_of_join_request_review();

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
