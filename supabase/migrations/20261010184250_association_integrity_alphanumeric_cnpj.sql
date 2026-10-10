-- Support Brazil's numeric and alphanumeric CNPJ formats and enforce
-- institutional field constraints in the database, not only in the UI.

CREATE OR REPLACE FUNCTION private.is_valid_cnpj(raw_cnpj text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO ''
AS $function$
DECLARE
  digits text;
  weights_first integer[] := ARRAY[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  weights_second integer[] := ARRAY[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  total integer;
  remainder integer;
  check_digit integer;
  i integer;
BEGIN
  IF raw_cnpj IS NULL OR pg_catalog.upper(raw_cnpj) !~ '^[A-Z0-9./ -]+$' THEN
    RETURN false;
  END IF;

  digits := pg_catalog.regexp_replace(pg_catalog.upper(raw_cnpj), '[^A-Z0-9]', '', 'g');
  IF pg_catalog.length(digits) <> 14
     OR digits !~ '^[A-Z0-9]{12}[0-9]{2}$'
     OR digits = pg_catalog.repeat(pg_catalog.substr(digits, 1, 1), 14) THEN
    RETURN false;
  END IF;

  total := 0;
  FOR i IN 1..12 LOOP
    total := total + (pg_catalog.ascii(pg_catalog.substr(digits, i, 1)) - 48) * weights_first[i];
  END LOOP;
  remainder := total % 11;
  check_digit := CASE WHEN remainder < 2 THEN 0 ELSE 11 - remainder END;
  IF check_digit <> pg_catalog.substr(digits, 13, 1)::integer THEN
    RETURN false;
  END IF;

  total := check_digit * weights_second[13];
  FOR i IN 1..12 LOOP
    total := total + (pg_catalog.ascii(pg_catalog.substr(digits, i, 1)) - 48) * weights_second[i];
  END LOOP;
  remainder := total % 11;
  check_digit := CASE WHEN remainder < 2 THEN 0 ELSE 11 - remainder END;

  RETURN check_digit = pg_catalog.substr(digits, 14, 1)::integer;
END;
$function$;

REVOKE EXECUTE ON FUNCTION private.is_valid_cnpj(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_valid_cnpj(text) TO authenticated;

ALTER TABLE public.associations
  ADD CONSTRAINT associations_name_length_check
  CHECK (pg_catalog.char_length(pg_catalog.btrim(name)) BETWEEN 3 AND 120);

ALTER TABLE public.associations
  ADD CONSTRAINT associations_cnpj_valid_check
  CHECK (cnpj IS NULL OR private.is_valid_cnpj(cnpj));

ALTER TABLE public.associations
  ADD CONSTRAINT associations_city_length_check
  CHECK (city IS NULL OR pg_catalog.char_length(pg_catalog.btrim(city)) BETWEEN 1 AND 120);

ALTER TABLE public.associations
  ADD CONSTRAINT associations_state_format_check
  CHECK (state IS NULL OR state ~ '^[A-Z]{2}$');

CREATE UNIQUE INDEX associations_cnpj_normalized_uidx
  ON public.associations (
    pg_catalog.upper(pg_catalog.regexp_replace(cnpj, '[^A-Z0-9]', '', 'g'))
  )
  WHERE cnpj IS NOT NULL AND pg_catalog.btrim(cnpj) <> '';

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

REVOKE EXECUTE ON FUNCTION public.create_association(text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_association(text, text, text, text) TO authenticated;
