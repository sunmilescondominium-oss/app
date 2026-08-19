-- =============================================================================
-- Migration 0077 — Hotel shift reports
--
-- Auto-generated when a cashier (or supervisor) closes a hotel cashier session.
-- Captures a point-in-time snapshot of all payments collected during the shift
-- and all cancelled ARs, so hotel_rental_monitoring can review and acknowledge.
-- =============================================================================

create table if not exists public.hotel_shift_reports (
  id                    uuid primary key default gen_random_uuid(),
  session_id            uuid not null references public.hotel_cashier_sessions(id) on delete cascade,

  -- Cashier identity (denormalised for report display)
  cashier_user_id       uuid not null,
  cashier_name          text not null,

  -- Shift period
  opened_at             timestamptz not null,
  closed_at             timestamptz not null,

  -- AR accountability
  beginning_ar_no       int not null,
  ending_ar_no          int not null,

  -- Snapshots (immutable after generation)
  payments_json         jsonb not null default '[]',   -- array of {stayId, guest, arNo, amount, paidAt}
  cancelled_ars_json    jsonb not null default '[]',   -- array of {arNo, reason, loggedAt}

  total_collected       numeric(14,2) not null default 0,
  ar_count              int not null default 0,        -- ARs issued (ending - beginning + 1 - cancelled)
  cancelled_count       int not null default 0,

  -- Whether the shift was force-closed by a supervisor
  closed_by_supervisor  boolean not null default false,
  closing_user_id       uuid,                          -- null = cashier closed own shift

  -- Acknowledgement by hotel_rental_monitoring / admin
  status                text not null default 'pending'
                        check (status in ('pending','acknowledged')),
  acknowledged_by       uuid references auth.users(id) on delete set null,
  acknowledged_at       timestamptz,
  acknowledged_notes    text,

  created_at            timestamptz not null default now()
);

create unique index if not exists hotel_shift_reports_session_unique
  on public.hotel_shift_reports(session_id);

create index if not exists idx_shift_reports_status
  on public.hotel_shift_reports(status, created_at desc);

-- ── RLS ───────────────────────────────────────────────────────────────────────

alter table public.hotel_shift_reports enable row level security;

-- Cashier can view their own reports; supervisors can view all
create policy hotel_shift_reports_sel on public.hotel_shift_reports
  for select to authenticated
  using (
    cashier_user_id = auth.uid()
    or public.has_any_role(array['admin','managing_officer','accounting','hotel_rental_monitoring','consultant'])
  );

-- Only supervisors can insert (via server action with service-role client)
create policy hotel_shift_reports_write on public.hotel_shift_reports
  for all to authenticated
  using (
    public.has_any_role(array['admin','managing_officer','accounting','hotel_rental_monitoring','consultant'])
  )
  with check (
    public.has_any_role(array['admin','managing_officer','accounting','hotel_rental_monitoring','consultant'])
  );

-- ── Also extend cashier session RLS to include accounting ─────────────────────

drop policy if exists hotel_cashier_sessions_sel on public.hotel_cashier_sessions;
create policy hotel_cashier_sessions_sel on public.hotel_cashier_sessions
  for select to authenticated
  using (
    cashier_user_id = auth.uid()
    or public.has_any_role(array['admin','managing_officer','accounting','hotel_rental_monitoring','consultant'])
  );

drop policy if exists hotel_cashier_sessions_write on public.hotel_cashier_sessions;
create policy hotel_cashier_sessions_write on public.hotel_cashier_sessions
  for all to authenticated
  using (
    cashier_user_id = auth.uid()
    or public.has_any_role(array['admin','managing_officer','accounting','hotel_rental_monitoring','consultant'])
  )
  with check (
    cashier_user_id = auth.uid()
    or public.has_any_role(array['admin','managing_officer','accounting','hotel_rental_monitoring','consultant'])
  );

drop policy if exists hotel_ar_cancellations_sel on public.hotel_ar_cancellations;
create policy hotel_ar_cancellations_sel on public.hotel_ar_cancellations
  for select to authenticated
  using (
    public.has_any_role(array['admin','managing_officer','accounting','hotel_rental_monitoring','consultant','hotel_cashier'])
  );

drop policy if exists hotel_ar_cancellations_write on public.hotel_ar_cancellations;
create policy hotel_ar_cancellations_write on public.hotel_ar_cancellations
  for all to authenticated
  using (
    public.has_any_role(array['admin','managing_officer','accounting','hotel_rental_monitoring','consultant','hotel_cashier'])
  )
  with check (
    public.has_any_role(array['admin','managing_officer','accounting','hotel_rental_monitoring','consultant','hotel_cashier'])
  );
