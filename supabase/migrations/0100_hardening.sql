-- Migration 0100: system hardening
-- 1. Notifications RLS (was missing entirely)
-- 2. Index on collections.unit_id (missing, causes full scans)
-- 3. Index on time_records.work_date (cron nightly query needs it)

-- ── 1. Notifications RLS ────────────────────────────────────────────────────
alter table public.notifications enable row level security;

-- Admins / management / consultant can read all (they monitor everyone).
create policy "notifications_admin_read" on public.notifications
  for select to authenticated
  using (public.has_any_role(array['admin', 'managing_officer', 'consultant']));

-- Everyone else sees only their own (by role or direct user).
create policy "notifications_own_read" on public.notifications
  for select to authenticated
  using (
    recipient_user_id = auth.uid()
    or (
      recipient_role is not null
      and exists (
        select 1 from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.role_key = recipient_role
      )
    )
  );

-- Writes always go through the service role (admin client) — no direct client inserts.
create policy "notifications_no_client_write" on public.notifications
  for insert to authenticated
  with check (false);

create policy "notifications_mark_read" on public.notifications
  for update to authenticated
  using (
    recipient_user_id = auth.uid()
    or (
      recipient_role is not null
      and exists (
        select 1 from public.user_roles ur
        where ur.user_id = auth.uid()
          and ur.role_key = recipient_role
      )
    )
  )
  with check (true);

-- ── 2. Missing index on collections.unit_id ─────────────────────────────────
create index if not exists collections_unit_id_idx
  on public.collections (unit_id)
  where unit_id is not null;

-- ── 3. Index on time_records(work_date) for the nightly auto-checkout cron ──
create index if not exists time_records_work_date_open_idx
  on public.time_records (work_date)
  where time_out is null;
