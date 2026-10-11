-- Prevent tenant/creator identity changes after an incident is created.
CREATE OR REPLACE FUNCTION public.guard_incident_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.association_id IS DISTINCT FROM OLD.association_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'A identidade e a associação da ocorrência não podem ser alteradas'
      USING ERRCODE = '23514';
  END IF;

  IF NEW.assigned_to IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.association_members AS m
    WHERE m.association_id = NEW.association_id
      AND m.user_id = NEW.assigned_to
  ) THEN
    RAISE EXCEPTION 'O responsável precisa ser membro da mesma associação'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.guard_incident_identity() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER incidents_guard_identity
  BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.guard_incident_identity();
