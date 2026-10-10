-- Enforce resident CPF validity/uniqueness and prevent cross-association unit links.

CREATE OR REPLACE FUNCTION private.is_valid_cpf(raw_cpf text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $function$
DECLARE
  digits text;
  total integer;
  check_digit integer;
  i integer;
BEGIN
  IF raw_cpf IS NULL THEN
    RETURN false;
  END IF;

  digits := pg_catalog.regexp_replace(raw_cpf, '[^0-9]', '', 'g');
  IF pg_catalog.length(digits) <> 11
     OR digits = pg_catalog.repeat(pg_catalog.substr(digits, 1, 1), 11) THEN
    RETURN false;
  END IF;

  total := 0;
  FOR i IN 1..9 LOOP
    total := total + pg_catalog.substr(digits, i, 1)::integer * (11 - i);
  END LOOP;
  check_digit := (total * 10) % 11;
  IF check_digit = 10 THEN
    check_digit := 0;
  END IF;
  IF check_digit <> pg_catalog.substr(digits, 10, 1)::integer THEN
    RETURN false;
  END IF;

  total := 0;
  FOR i IN 1..10 LOOP
    total := total + pg_catalog.substr(digits, i, 1)::integer * (12 - i);
  END LOOP;
  check_digit := (total * 10) % 11;
  IF check_digit = 10 THEN
    check_digit := 0;
  END IF;

  RETURN check_digit = pg_catalog.substr(digits, 11, 1)::integer;
END;
$function$;

REVOKE EXECUTE ON FUNCTION private.is_valid_cpf(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_valid_cpf(text) TO authenticated;

ALTER TABLE public.residents
  ADD CONSTRAINT residents_cpf_valid_check
  CHECK (
    cpf IS NULL
    OR (cpf ~ '^[0-9./ -]+$' AND private.is_valid_cpf(cpf))
  );

CREATE UNIQUE INDEX residents_association_cpf_normalized_uidx
  ON public.residents (
    association_id,
    pg_catalog.regexp_replace(cpf, '[^0-9]', '', 'g')
  )
  WHERE cpf IS NOT NULL;

-- A unit reference must belong to the same association as its resident.
-- PostgreSQL 17 supports SET NULL on only the unit_id column, preserving the
-- required association_id when a unit is deleted.
CREATE UNIQUE INDEX units_association_id_id_uidx
  ON public.units (association_id, id);

ALTER TABLE public.residents
  DROP CONSTRAINT IF EXISTS residents_unit_id_fkey;

ALTER TABLE public.residents
  ADD CONSTRAINT residents_association_unit_fk
  FOREIGN KEY (association_id, unit_id)
  REFERENCES public.units (association_id, id)
  ON DELETE SET NULL (unit_id);
