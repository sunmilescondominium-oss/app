-- 0056_collection_edits.sql
-- Authorized, justified edits to collection entries (including already-
-- transmitted ones) for error correction. Every edit is recorded here with the
-- before/after snapshot and the justification. The gate (authority role +
-- CONFIRM EDIT + employee-code/passcode re-auth) is enforced in the action.

create table if not exists public.collection_edits (
  id            uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  edited_by     uuid references auth.users(id) on delete set null,
  editor_role   text,
  justification text not null,
  before_json   jsonb not null,
  after_json    jsonb not null,
  created_at    timestamptz not null default now()
);

create index if not exists idx_collection_edits_collection on public.collection_edits(collection_id);

alter table public.collection_edits enable row level security;

-- Authorized roles may review the edit history; writes go through the service
-- role in the action (never directly from the client).
drop policy if exists collection_edits_select on public.collection_edits;
create policy collection_edits_select on public.collection_edits for select to authenticated
  using (public.has_any_role(array['admin', 'managing_officer', 'operations_manager', 'accounting', 'consultant']));
