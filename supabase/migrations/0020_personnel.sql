-- =============================================================================
-- Migration 0020 — Employee 201 / personnel file + documents
--
-- One personnel record per staff account (personal + contact, statutory IDs,
-- employment details) and a private per-employee document folder. Statutory
-- IDs are personal data (RA 10173): stored in HR-only tables, served via the
-- service role behind the Employees module, never exposed to the browser bundle.
-- Idempotent.
-- =============================================================================

create table if not exists public.employee_profiles (
  user_id            uuid primary key references auth.users(id) on delete cascade,
  -- Personal & contact
  address            text,
  birthdate          date,
  phone              text,
  personal_email     text,
  emergency_name     text,
  emergency_phone    text,
  -- Statutory IDs (RA 10173 — HR access only)
  sss_no             text,
  philhealth_no      text,
  pagibig_no         text,
  tin_no             text,
  -- Employment
  position           text,
  department         text,
  employment_type    text,           -- Regular / Contractual / OJT / Intern / ...
  date_hired         date,
  date_regularized   date,
  notes              text,
  updated_at         timestamptz not null default now()
);

drop trigger if exists trg_employee_profiles_updated_at on public.employee_profiles;
create trigger trg_employee_profiles_updated_at before update on public.employee_profiles
  for each row execute function public.set_updated_at();

create table if not exists public.employee_documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  doc_type    text not null,
  file_path   text not null,
  note        text,
  uploaded_by uuid references auth.users(id),
  created_at  timestamptz not null default now()
);
create index if not exists idx_employee_docs_user on public.employee_documents(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS — HR roles (the Employees module) manage both.
-- ---------------------------------------------------------------------------
alter table public.employee_profiles  enable row level security;
alter table public.employee_documents enable row level security;

drop policy if exists employee_profiles_all on public.employee_profiles;
create policy employee_profiles_all on public.employee_profiles for all to authenticated
  using (public.has_any_role(array['admin', 'managing_officer', 'operations_manager', 'consultant', 'accounting', 'warehouse_timekeeper']))
  with check (public.has_any_role(array['admin', 'managing_officer', 'operations_manager', 'consultant', 'accounting', 'warehouse_timekeeper']));

drop policy if exists employee_documents_all on public.employee_documents;
create policy employee_documents_all on public.employee_documents for all to authenticated
  using (public.has_any_role(array['admin', 'managing_officer', 'operations_manager', 'consultant', 'accounting', 'warehouse_timekeeper']))
  with check (public.has_any_role(array['admin', 'managing_officer', 'operations_manager', 'consultant', 'accounting', 'warehouse_timekeeper']));
