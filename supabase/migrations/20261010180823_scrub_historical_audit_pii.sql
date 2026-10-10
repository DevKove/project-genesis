-- One-time cleanup for audit snapshots written before PII redaction was enabled.
-- The temporary recursive function removes sensitive keys from nested objects
-- and arrays, then is dropped so it does not become part of the application API.

CREATE OR REPLACE FUNCTION private._redact_audit_jsonb(value jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SET search_path TO 'pg_catalog'
AS $function$
  SELECT CASE jsonb_typeof(value)
    WHEN 'object' THEN COALESCE(
      (
        SELECT jsonb_object_agg(e.key, private._redact_audit_jsonb(e.value))
        FROM jsonb_each(value) AS e
        WHERE e.key <> ALL (ARRAY[
          'cpf',
          'email',
          'phone',
          'birth_date',
          'notes',
          'token',
          'address',
          'zip_code',
          'cnpj',
          'avatar_url',
          'logo_url',
          'full_name',
          'body',
          'created_by',
          'invited_by'
        ]::text[])
      ),
      '{}'::jsonb
    )
    WHEN 'array' THEN COALESCE(
      (
        SELECT jsonb_agg(private._redact_audit_jsonb(e.value))
        FROM jsonb_array_elements(value) AS e(value)
      ),
      '[]'::jsonb
    )
    ELSE value
  END;
$function$;

UPDATE public.audit_logs
SET details = private._redact_audit_jsonb(details)
  || jsonb_build_object('historical_redaction_applied', true)
WHERE details IS NOT NULL
  AND (
    jsonb_path_exists(details, '$.**.cpf')
    OR jsonb_path_exists(details, '$.**.email')
    OR jsonb_path_exists(details, '$.**.phone')
    OR jsonb_path_exists(details, '$.**.birth_date')
    OR jsonb_path_exists(details, '$.**.notes')
    OR jsonb_path_exists(details, '$.**.token')
    OR jsonb_path_exists(details, '$.**.address')
    OR jsonb_path_exists(details, '$.**.zip_code')
    OR jsonb_path_exists(details, '$.**.cnpj')
    OR jsonb_path_exists(details, '$.**.avatar_url')
    OR jsonb_path_exists(details, '$.**.logo_url')
    OR jsonb_path_exists(details, '$.**.full_name')
    OR jsonb_path_exists(details, '$.**.body')
    OR jsonb_path_exists(details, '$.**.created_by')
    OR jsonb_path_exists(details, '$.**.invited_by')
  );

DROP FUNCTION private._redact_audit_jsonb(jsonb);
