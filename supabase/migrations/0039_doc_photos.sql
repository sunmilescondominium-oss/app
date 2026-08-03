-- =============================================================================
-- Migration 0039 — Generic live-photo documentation + incident reports
--
-- doc_photos attaches timestamped, live-captured photos to ANY record
-- (transmittal deposit slip, room inspection, inventory count, unit move-in/out,
-- incident). captured_at is stored so a stamp far off server time can be flagged.
-- incidents = guard/staff incident & safety reports (with photo/video docs).
-- Role-based only.
-- =============================================================================

create table if not exists public.doc_photos (
  id            uuid primary key default gen_random_uuid(),
  entity        text not null,   -- 'transmittal' | 'housekeeping_task' | 'stock_count' | 'lease' | 'incident'
  entity_id     text not null,
  kind          text not null,   -- 'deposit_slip' | 'passbook' | 'inspection' | 'count' | 'move_in' | 'move_out' | 'incident'
  storage_path  text not null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role    text,
  captured_at   timestamptz,
  server_at     timestamptz not null default now(),
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists idx_doc_photos_entity on public.doc_photos(entity, entity_id, created_at desc);

alter table public.doc_photos enable row level security;
drop policy if exists doc_photos_select on public.doc_photos;
-- Broad read for signed-in staff; the serving route re-checks the module tied to
-- the entity. Writes go through the service role after per-entity validation.
create policy doc_photos_select on public.doc_photos for select to authenticated using (true);

-- Incident reports ------------------------------------------------------------
create table if not exists public.incidents (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  category         text not null default 'other' check (category in ('security', 'safety', 'damage', 'other')),
  location         text,
  description      text,
  status           text not null default 'open' check (status in ('open', 'resolved')),
  reported_by_role text,
  reported_by_user uuid references auth.users(id) on delete set null,
  resolved_at      timestamptz,
  created_at       timestamptz not null default now()
);
create index if not exists idx_incidents_created on public.incidents(created_at desc);

alter table public.incidents enable row level security;
drop policy if exists incidents_select on public.incidents;
create policy incidents_select on public.incidents for select to authenticated
  using (public.has_any_role(array['admin', 'managing_officer', 'operations_manager', 'owner', 'consultant', 'guard', 'electrician', 'utility']));
drop policy if exists incidents_write on public.incidents;
create policy incidents_write on public.incidents for all to authenticated
  using (public.has_any_role(array['admin', 'managing_officer', 'operations_manager', 'guard', 'electrician', 'utility']))
  with check (public.has_any_role(array['admin', 'managing_officer', 'operations_manager', 'guard', 'electrician', 'utility']));
