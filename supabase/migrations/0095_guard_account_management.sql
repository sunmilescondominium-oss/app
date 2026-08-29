-- =============================================================================
-- Migration 0095 — Guard Account Management
--
-- • Guard profile metadata: agency, position, contract expiry, NDA acknowledgment
-- • Guard handover reports: outgoing guard's shift notes, incoming guard acknowledges
-- =============================================================================

-- ---------------------------------------------------------------------------
-- profiles — guard metadata columns
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists guard_agency                text,
  add column if not exists guard_position              text,
  add column if not exists guard_contract_expires_at   timestamptz,
  add column if not exists guard_nda_acknowledged_at   timestamptz;

-- ---------------------------------------------------------------------------
-- guard_handover_reports — shift-end notes passed to the next guard
-- ---------------------------------------------------------------------------
create table if not exists public.guard_handover_reports (
  id                uuid primary key default gen_random_uuid(),
  outgoing_shift_id uuid references public.guard_shifts(id) on delete set null,
  outgoing_guard_id uuid not null references public.profiles(id) on delete cascade,
  post_id           uuid not null references public.guard_posts(id),
  shift_type        text not null check (shift_type in ('day', 'night')),
  incidents_notes   text,
  pending_items     text,
  acknowledged_at   timestamptz,
  acknowledged_by   uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);

create index if not exists idx_guard_handover_post
  on public.guard_handover_reports(post_id, created_at desc);

alter table public.guard_handover_reports enable row level security;

-- Guards can insert their own handover; read own or for their post
create policy "handover_guard_insert" on public.guard_handover_reports
  for insert to authenticated
  with check (
    outgoing_guard_id = auth.uid()
    and public.has_any_role(array['guard'])
  );

create policy "handover_guard_update_ack" on public.guard_handover_reports
  for update to authenticated
  using (
    public.has_any_role(array['guard'])
    and acknowledged_at is null
  );

create policy "handover_select" on public.guard_handover_reports
  for select to authenticated
  using (
    public.has_any_role(array[
      'guard', 'admin', 'managing_officer', 'operations_manager',
      'hotel_rental_monitoring', 'consultant', 'owner'
    ])
  );

-- Management can update (corrections / admin edits)
create policy "handover_admin_update" on public.guard_handover_reports
  for update to authenticated
  using (
    public.has_any_role(array['admin', 'managing_officer', 'consultant'])
  );
