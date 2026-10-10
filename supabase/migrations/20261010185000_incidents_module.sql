-- Association incidents: member-submitted reports with manager-controlled workflow.
CREATE TABLE public.incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES public.associations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  category text NOT NULL DEFAULT 'geral',
  priority text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'aberta',
  created_by uuid NOT NULL,
  assigned_to uuid,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT incidents_title_length_check CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  CONSTRAINT incidents_description_length_check CHECK (char_length(btrim(description)) BETWEEN 1 AND 5000),
  CONSTRAINT incidents_category_check CHECK (category IN ('seguranca','manutencao','limpeza','ruido','iluminacao','areas_comuns','outro','geral')),
  CONSTRAINT incidents_priority_check CHECK (priority IN ('baixa','normal','alta','urgente')),
  CONSTRAINT incidents_status_check CHECK (status IN ('aberta','em_andamento','resolvida','cancelada')),
  CONSTRAINT incidents_resolution_notes_length_check CHECK (resolution_notes IS NULL OR char_length(resolution_notes) <= 2000)
);

CREATE INDEX incidents_association_status_created_idx
  ON public.incidents (association_id, status, created_at DESC);
CREATE INDEX incidents_creator_idx ON public.incidents (created_by, created_at DESC);

GRANT SELECT, INSERT, UPDATE ON public.incidents TO authenticated;
GRANT ALL ON public.incidents TO service_role;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read own incidents and managers read all"
  ON public.incidents FOR SELECT TO authenticated
  USING (
    created_by = (SELECT auth.uid())
    OR private.is_assoc_manager(association_id, (SELECT auth.uid()))
  );

CREATE POLICY "members create incidents for themselves"
  ON public.incidents FOR INSERT TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND private.is_member(association_id, (SELECT auth.uid()))
    AND assigned_to IS NULL
    AND status = 'aberta'
  );

CREATE POLICY "managers update incidents"
  ON public.incidents FOR UPDATE TO authenticated
  USING (private.is_assoc_manager(association_id, (SELECT auth.uid())))
  WITH CHECK (private.is_assoc_manager(association_id, (SELECT auth.uid())));

CREATE TRIGGER incidents_touch_updated_at
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Keep the audit trail useful without copying free text, titles, or personal data.
CREATE OR REPLACE FUNCTION public.audit_incident_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  incident_id text;
  association_id_value uuid;
  operation_name text;
  safe_details jsonb;
BEGIN
  operation_name := pg_catalog.lower(TG_OP);
  IF TG_OP = 'DELETE' THEN
    incident_id := OLD.id::text;
    association_id_value := OLD.association_id;
    safe_details := pg_catalog.jsonb_build_object(
      'status', OLD.status, 'priority', OLD.priority, 'category', OLD.category,
      'campos_redigidos', pg_catalog.jsonb_build_array('title','description','resolution_notes')
    );
  ELSIF TG_OP = 'UPDATE' THEN
    incident_id := NEW.id::text;
    association_id_value := NEW.association_id;
    safe_details := pg_catalog.jsonb_build_object(
      'status_antes', OLD.status, 'status_depois', NEW.status,
      'prioridade_antes', OLD.priority, 'prioridade_depois', NEW.priority,
      'campos_redigidos', pg_catalog.jsonb_build_array('title','description','resolution_notes')
    );
  ELSE
    incident_id := NEW.id::text;
    association_id_value := NEW.association_id;
    safe_details := pg_catalog.jsonb_build_object(
      'status', NEW.status, 'priority', NEW.priority, 'category', NEW.category,
      'campos_redigidos', pg_catalog.jsonb_build_array('title','description','resolution_notes')
    );
  END IF;

  INSERT INTO public.audit_logs (association_id, user_id, action, entity, entity_id, details)
  VALUES (association_id_value, auth.uid(), operation_name, 'incidents', incident_id, safe_details);
  RETURN NULL;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.audit_incident_change() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER incidents_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.audit_incident_change();
