-- Association service requests with tenant-scoped access and redacted audit metadata.
CREATE TABLE public.service_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'outro',
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'aberta',
  created_by uuid NOT NULL,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_requests_title_length_check CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  CONSTRAINT service_requests_description_length_check CHECK (char_length(btrim(description)) BETWEEN 1 AND 5000),
  CONSTRAINT service_requests_category_check CHECK (category IN ('cadastro','manutencao','documentos','financeiro','convivencia','outro')),
  CONSTRAINT service_requests_priority_check CHECK (priority IN ('baixa','normal','alta','urgente')),
  CONSTRAINT service_requests_status_check CHECK (status IN ('aberta','em_analise','aguardando_morador','atendida','recusada','cancelada')),
  CONSTRAINT service_requests_resolution_notes_length_check CHECK (resolution_notes IS NULL OR char_length(resolution_notes) <= 2000)
);

CREATE INDEX service_requests_association_status_created_idx
  ON public.service_requests (association_id, status, created_at DESC);
CREATE INDEX service_requests_creator_idx
  ON public.service_requests (created_by, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.service_requests TO authenticated;
GRANT ALL ON public.service_requests TO service_role;
ALTER TABLE public.service_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read own service requests and managers read all"
  ON public.service_requests FOR SELECT TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR private.is_assoc_manager(association_id, (SELECT auth.uid()))
  );

CREATE POLICY "members create own service requests"
  ON public.service_requests FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND private.is_member(association_id, (SELECT auth.uid()))
    AND status = 'aberta'
  );

CREATE POLICY "managers update service requests"
  ON public.service_requests FOR UPDATE TO authenticated
  USING (private.is_assoc_manager(association_id, (SELECT auth.uid())))
  WITH CHECK (private.is_assoc_manager(association_id, (SELECT auth.uid())));

CREATE OR REPLACE FUNCTION public.guard_service_request_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.association_id IS DISTINCT FROM OLD.association_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'A identidade e a associação da solicitação não podem ser alteradas'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.guard_service_request_identity() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.audit_service_request_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  request_id text;
  association_id_value uuid;
  operation_name text;
  safe_details jsonb;
BEGIN
  operation_name := pg_catalog.lower(TG_OP);
  IF TG_OP = 'DELETE' THEN
    request_id := OLD.id::text;
    association_id_value := OLD.association_id;
    safe_details := pg_catalog.jsonb_build_object(
      'status', OLD.status, 'priority', OLD.priority, 'category', OLD.category,
      'campos_redigidos', pg_catalog.jsonb_build_array('title','description','resolution_notes')
    );
  ELSIF TG_OP = 'UPDATE' THEN
    request_id := NEW.id::text;
    association_id_value := NEW.association_id;
    safe_details := pg_catalog.jsonb_build_object(
      'status_antes', OLD.status, 'status_depois', NEW.status,
      'prioridade_antes', OLD.priority, 'prioridade_depois', NEW.priority,
      'campos_redigidos', pg_catalog.jsonb_build_array('title','description','resolution_notes')
    );
  ELSE
    request_id := NEW.id::text;
    association_id_value := NEW.association_id;
    safe_details := pg_catalog.jsonb_build_object(
      'status', NEW.status, 'priority', NEW.priority, 'category', NEW.category,
      'campos_redigidos', pg_catalog.jsonb_build_array('title','description','resolution_notes')
    );
  END IF;

  INSERT INTO public.audit_logs (association_id, user_id, action, entity, entity_id, details)
  VALUES (association_id_value, auth.uid(), operation_name, 'service_requests', request_id, safe_details);
  RETURN NULL;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.audit_service_request_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER service_requests_touch_updated_at
  BEFORE UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER service_requests_guard_identity
  BEFORE UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.guard_service_request_identity();
CREATE TRIGGER service_requests_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.audit_service_request_change();
