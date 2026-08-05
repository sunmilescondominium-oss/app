-- =============================================================================
-- Migration 0045 — DTR adjustment trail with owner approval.
--
-- Every critical change to a time record (overwrite via import, manual edit,
-- delete) is recorded here with old → new values and a reason. Adjustments start
-- 'pending' and must be APPROVED by the owner/CEO; they print on the payroll the
-- owner signs. Rejecting reverts the record to its previous values.
-- =============================================================================

create table if not exists public.dtr_adjustments (
  id              uuid primary key default gen_random_uuid(),
  time_record_id  uuid,                    -- may be null for a delete
  user_id         uuid not null references auth.users(id) on delete cascade,
  work_date       date not null,
  action          text not null default 'overwrite' check (action in ('overwrite', 'manual_edit', 'delete')),
  old_time_in     timestamptz, old_time_out timestamptz,
  new_time_in     timestamptz, new_time_out timestamptz,
  reason          text,
  changed_by      uuid references auth.users(id) on delete set null,
  changed_by_role text,
  status          text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  approved_by     uuid references auth.users(id) on delete set null,
  approved_by_role text,
  approved_at     timestamptz,
  decision_note   text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_dtr_adj_date on public.dtr_adjustments(work_date, created_at desc);
create index if not exists idx_dtr_adj_status on public.dtr_adjustments(status);

alter table public.dtr_adjustments enable row level security;
drop policy if exists dtr_adjustments_sel on public.dtr_adjustments;
create policy dtr_adjustments_sel on public.dtr_adjustments for select to authenticated
  using (public.has_any_role(array['owner', 'consultant', 'admin', 'managing_officer', 'accounting', 'warehouse_timekeeper']));
