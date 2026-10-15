-- Rate-limit public association-code lookup before authentication.
CREATE TABLE IF NOT EXISTS public.association_code_lookup_limits (
  ip_hash text PRIMARY KEY CHECK (ip_hash ~ '^[a-f0-9]{64}$'),
  minute_started_at timestamptz NOT NULL DEFAULT now(),
  minute_count integer NOT NULL DEFAULT 0 CHECK (minute_count >= 0),
  hour_started_at timestamptz NOT NULL DEFAULT now(),
  hour_count integer NOT NULL DEFAULT 0 CHECK (hour_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.association_code_lookup_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.association_code_lookup_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_association_code_lookup_limit(_ip_hash text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_now timestamptz := clock_timestamp();
  allowed boolean;
BEGIN
  IF _ip_hash IS NULL OR _ip_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN false;
  END IF;

  INSERT INTO public.association_code_lookup_limits (
    ip_hash, minute_started_at, minute_count, hour_started_at, hour_count, updated_at
  ) VALUES (
    _ip_hash, v_now, 1, v_now, 1, v_now
  )
  ON CONFLICT (ip_hash) DO UPDATE SET
    minute_count = CASE
      WHEN public.association_code_lookup_limits.minute_started_at <= v_now - interval '1 minute' THEN 1
      ELSE public.association_code_lookup_limits.minute_count + 1
    END,
    minute_started_at = CASE
      WHEN public.association_code_lookup_limits.minute_started_at <= v_now - interval '1 minute' THEN v_now
      ELSE public.association_code_lookup_limits.minute_started_at
    END,
    hour_count = CASE
      WHEN public.association_code_lookup_limits.hour_started_at <= v_now - interval '1 hour' THEN 1
      ELSE public.association_code_lookup_limits.hour_count + 1
    END,
    hour_started_at = CASE
      WHEN public.association_code_lookup_limits.hour_started_at <= v_now - interval '1 hour' THEN v_now
      ELSE public.association_code_lookup_limits.hour_started_at
    END,
    updated_at = v_now;

  SELECT minute_count <= 10 AND hour_count <= 50
    INTO allowed
    FROM public.association_code_lookup_limits
    WHERE ip_hash = _ip_hash;

  RETURN COALESCE(allowed, false);
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_association_code_lookup_limit(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_association_code_lookup_limit(text) TO service_role;

-- After the rate-limited Edge Function is deployed, remove direct browser access.
REVOKE EXECUTE ON FUNCTION public.lookup_association_by_code(text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.lookup_association_by_code(text) TO service_role;
