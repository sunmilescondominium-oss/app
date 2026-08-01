-- =============================================================================
-- Migration 0006 — Dispute / Case Log per unit (M5)
--
-- Tracks disputes with a status workflow + next/target actions. lawyer_notes
-- are consultant-visible (stripped server-side for other readers). Historical
-- cases are seeded as is_reference records so future disputes start from a
-- template, not zero.
--
-- Idempotent.
-- =============================================================================

create table if not exists public.disputes (
  id           uuid primary key default gen_random_uuid(),
  unit_id      uuid references public.units(id) on delete set null,
  buyer_id     uuid references public.buyers(id) on delete set null,
  case_ref     text,                                   -- external ref (e.g. DHSUD case no.)
  issue_type   text not null default 'General',
  status       text not null default 'open'
               check (status in ('open', 'in_progress', 'resolved', 'escalated')),
  last_action  text,
  next_action  text,
  target_date  date,
  lawyer_notes text,                                   -- consultant-visible
  is_reference boolean not null default false,         -- institutional reference record
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_disputes_unit on public.disputes(unit_id);
create index if not exists idx_disputes_status on public.disputes(status);

drop trigger if exists trg_disputes_updated_at on public.disputes;
create trigger trg_disputes_updated_at
  before update on public.disputes
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — mirrors lib/rbac/modules.ts (module "disputes").
-- read = consultant, managing_officer, operations_manager · write = consultant, admin
-- ---------------------------------------------------------------------------
alter table public.disputes enable row level security;

drop policy if exists disputes_select on public.disputes;
create policy disputes_select
  on public.disputes for select to authenticated
  using (public.has_any_role(array['consultant', 'managing_officer', 'operations_manager']));

drop policy if exists disputes_write on public.disputes;
create policy disputes_write
  on public.disputes for all to authenticated
  using (public.has_any_role(array['consultant', 'admin']))
  with check (public.has_any_role(array['consultant', 'admin']));
