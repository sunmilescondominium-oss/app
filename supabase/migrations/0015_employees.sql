-- =============================================================================
-- Migration 0015 — Employee photos + leave requests
--
--   • profiles.photo_path — a private staff photo, uploaded by HR/admin/etc.
--     (roles enforced in the app; stored in the private "staff-photos" bucket).
--   • leave_requests — employee self-service leave, approved by the approver
--     roles (admin / managing_officer / operations_manager — TODO(client-confirm)).
--
-- Role-based, not person-based: everything keys off the user account + the
-- user's chosen display label. Idempotent.
-- =============================================================================

alter table public.profiles add column if not exists photo_path text;

create table if not exists public.leave_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  leave_type    text not null,
  start_date    date not null,
  end_date      date not null,
  days          numeric(4, 1) not null default 1,
  reason        text,
  status        text not null default 'pending'
                  check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  decided_by    uuid references auth.users(id),
  decided_at    timestamptz,
  decision_note text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_leave_user on public.leave_requests(user_id, start_date desc);
create index if not exists idx_leave_pending on public.leave_requests(status) where status = 'pending';

drop trigger if exists trg_leave_updated_at on public.leave_requests;
create trigger trg_leave_updated_at before update on public.leave_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS — employees manage their own requests; approvers see & decide all.
-- ---------------------------------------------------------------------------
alter table public.leave_requests enable row level security;

drop policy if exists leave_select on public.leave_requests;
create policy leave_select on public.leave_requests for select to authenticated
  using (user_id = auth.uid()
         or public.has_any_role(array['admin', 'managing_officer', 'operations_manager', 'accounting', 'consultant', 'warehouse_timekeeper']));

drop policy if exists leave_insert on public.leave_requests;
create policy leave_insert on public.leave_requests for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists leave_update on public.leave_requests;
create policy leave_update on public.leave_requests for update to authenticated
  using (
    (user_id = auth.uid() and status = 'pending')
    or public.has_any_role(array['owner', 'admin', 'managing_officer', 'operations_manager'])
  )
  with check (true);

drop policy if exists leave_delete on public.leave_requests;
create policy leave_delete on public.leave_requests for delete to authenticated
  using (user_id = auth.uid() and status = 'pending');
