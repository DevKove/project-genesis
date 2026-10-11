-- Keep the private manager helper's search path empty, consistent with other SECURITY DEFINER helpers.
-- The function body uses fully qualified object names, so this does not change its behavior.
ALTER FUNCTION private.is_assoc_manager(uuid, uuid) SET search_path TO '';
