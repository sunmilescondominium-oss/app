-- =============================================================================
-- Migration 0008 — Repair-Request portal (M7, Module 3C pulled forward)
--
-- Public tenant/guest submissions (inserted via the service role in a public
-- action) auto-assigned to operations_manager, then routed to electrician /
-- utility. No verbal-only requests: everything is a logged row with timestamps.
--
-- Idempotent.
-- =============================================================================

create table if not exists public.repair_requests (
  id                uuid primary key default gen_random_uuid(),
  ticket_ref        text not null unique,
  unit_id           uuid references public.units(id) on delete set null,
  requester_type    text not null check (requester_type in ('tenant', 'guest')),
  requester_ref     text,                      -- unit#+PIN context or booking ref
  requester_contact text,                      -- optional email/phone for updates
  issue_type        text not null default 'General',
  description       text not null,
  urgency           text not null default 'normal' check (urgency in ('low', 'normal', 'urgent')),
  photo_path        text,
  status            text not null default 'submitted'
                    check (status in ('submitted', 'assigned', 'in_progress', 'completed')),
  assigned_to_role  text references public.roles(role_key),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_repair_requests_status on public.repair_requests(status);
create index if not exists idx_repair_requests_created on public.repair_requests(created_at desc);

drop trigger if exists trg_repair_requests_updated_at on public.repair_requests;
create trigger trg_repair_requests_updated_at
  before update on public.repair_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — mirrors lib/rbac/modules.ts (module "repair").
-- read/write = operations_manager, electrician, utility, admin.
-- Public submissions are inserted via the service role in a public action.
-- ---------------------------------------------------------------------------
alter table public.repair_requests enable row level security;

drop policy if exists repair_requests_select on public.repair_requests;
create policy repair_requests_select
  on public.repair_requests for select to authenticated
  using (public.has_any_role(array['operations_manager', 'electrician', 'utility', 'admin']));

drop policy if exists repair_requests_write on public.repair_requests;
create policy repair_requests_write
  on public.repair_requests for all to authenticated
  using (public.has_any_role(array['operations_manager', 'electrician', 'utility', 'admin']))
  with check (public.has_any_role(array['operations_manager', 'electrician', 'utility', 'admin']));
