-- Unique six-digit association codes used during signup instead of exposing a public association list.
ALTER TABLE public.associations
  ADD COLUMN IF NOT EXISTS association_code text;

DO $backfill$
DECLARE
  association_row record;
  generated_code text;
  attempts integer;
BEGIN
  FOR association_row IN
    SELECT id FROM public.associations WHERE association_code IS NULL
  LOOP
    attempts := 0;
    LOOP
      generated_code := (floor(random() * 900000)::integer + 100000)::text;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.associations WHERE association_code = generated_code
      );
      attempts := attempts + 1;
      IF attempts > 1000 THEN
        RAISE EXCEPTION 'Não foi possível gerar um código único para a associação %', association_row.id;
      END IF;
    END LOOP;

    UPDATE public.associations
    SET association_code = generated_code
    WHERE id = association_row.id;
  END LOOP;
END;
$backfill$;

ALTER TABLE public.associations
  ALTER COLUMN association_code SET NOT NULL;

ALTER TABLE public.associations
  ADD CONSTRAINT associations_code_six_digits_check
  CHECK (association_code ~ '^[0-9]{6}$');

CREATE UNIQUE INDEX IF NOT EXISTS associations_association_code_uidx
  ON public.associations (association_code);

CREATE OR REPLACE FUNCTION public.assign_association_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  generated_code text;
  attempts integer := 0;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.association_code IS DISTINCT FROM OLD.association_code THEN
      RAISE EXCEPTION 'O código da associação é imutável';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.association_code IS NULL OR NEW.association_code = '' THEN
    LOOP
      generated_code := (floor(random() * 900000)::integer + 100000)::text;
      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM public.associations WHERE association_code = generated_code
      );
      attempts := attempts + 1;
      IF attempts > 1000 THEN
        RAISE EXCEPTION 'Não foi possível gerar um código único de associação';
      END IF;
    END LOOP;
    NEW.association_code := generated_code;
  ELSIF NEW.association_code !~ '^[0-9]{6}$' THEN
    RAISE EXCEPTION 'O código da associação deve conter exatamente 6 dígitos';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.assign_association_code() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS assign_association_code_before_write ON public.associations;
CREATE TRIGGER assign_association_code_before_write
  BEFORE INSERT OR UPDATE OF association_code ON public.associations
  FOR EACH ROW EXECUTE FUNCTION public.assign_association_code();

CREATE OR REPLACE FUNCTION public.lookup_association_by_code(_code text)
RETURNS TABLE (id uuid, name text, city text, state text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  SELECT a.id, a.name, a.city, a.state
  FROM public.associations AS a
  WHERE a.association_code = pg_catalog.btrim(_code)
    AND _code ~ '^[0-9]{6}$'
    AND a.status = 'ativa'
  LIMIT 1;
$function$;

REVOKE EXECUTE ON FUNCTION public.lookup_association_by_code(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_association_by_code(text) TO anon, authenticated;