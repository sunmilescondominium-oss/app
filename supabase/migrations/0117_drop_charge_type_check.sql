-- Drop the hardcoded CHECK constraint on collections.charge_type.
-- The constraint was added in 0064 with 7 fixed keys but the catalog
-- (collection_item_types, added in 0070) is now the source of truth.
-- Any active key in collection_item_types must be storable.

DO $$
DECLARE
  _con text;
BEGIN
  SELECT conname INTO _con
  FROM pg_constraint
  WHERE conrelid = 'public.collections'::regclass
    AND contype = 'c'
    AND conname ILIKE '%charge_type%';
  IF _con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.collections DROP CONSTRAINT %I', _con);
  END IF;
END;
$$;
