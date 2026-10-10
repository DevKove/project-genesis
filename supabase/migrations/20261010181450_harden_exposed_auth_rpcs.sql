-- Migration-history alignment entry.
-- The RPC hardening SQL at version 20261010181344 was retried against the
-- connected project, producing a second recorded version 20261010181450.
-- The retry was idempotent and left the same function definitions/grants.
-- Keep this no-op entry so fresh environments and the connected project's
-- migration history stay version-aligned without applying the same DDL twice.
DO $migration$
BEGIN
  PERFORM 1;
END
$migration$;
