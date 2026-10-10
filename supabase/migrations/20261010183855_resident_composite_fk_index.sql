-- Cover the composite resident-to-unit foreign key for deletes and joins.
CREATE INDEX IF NOT EXISTS residents_association_unit_idx
  ON public.residents (association_id, unit_id);
