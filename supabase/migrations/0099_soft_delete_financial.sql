-- Soft-delete columns for collections and transmittals.
-- Hard DELETE is reserved for consultant-only purge; all other deletes use soft-delete.

alter table public.collections
  add column if not exists deleted_at  timestamptz,
  add column if not exists deleted_by  uuid references auth.users(id) on delete set null;

alter table public.transmittals
  add column if not exists deleted_at  timestamptz,
  add column if not exists deleted_by  uuid references auth.users(id) on delete set null;

-- Index makes "WHERE deleted_at IS NULL" scans fast on both tables.
create index if not exists collections_deleted_at_idx  on public.collections  (deleted_at) where deleted_at is not null;
create index if not exists transmittals_deleted_at_idx on public.transmittals (deleted_at) where deleted_at is not null;
