-- Employee work-related reports (DPA-compliant, internal only)
create table if not exists public.employee_reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references public.profiles(id) on delete cascade,
  subject      text not null check (char_length(subject) between 5 and 200),
  body         text not null check (char_length(body) between 10 and 4000),
  category     text not null default 'general' check (category in ('general', 'safety', 'compliance', 'suggestion', 'grievance', 'other')),
  dpa_consent  boolean not null default false,
  is_anonymous boolean not null default false,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.employee_reports enable row level security;

-- Employees can insert their own report only with DPA consent
create policy employee_reports_insert on public.employee_reports
  for insert to authenticated
  with check (
    reporter_id = auth.uid()
    and dpa_consent = true
  );

-- The reporter can read their own report
create policy employee_reports_own_select on public.employee_reports
  for select to authenticated
  using (reporter_id = auth.uid());

-- Admin, owner, consultant can read all (not anonymous reporter details filtered in app layer)
create policy employee_reports_mgmt_select on public.employee_reports
  for select to authenticated
  using (public.has_any_role(array['admin', 'owner', 'consultant']));

-- No updates or deletes by normal roles — admin can manage via service role if needed
