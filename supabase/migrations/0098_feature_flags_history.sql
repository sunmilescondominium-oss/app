-- Audit log for feature_flag toggles.
create table if not exists public.feature_flags_history (
  id              bigserial primary key,
  key             text not null,
  old_enabled     boolean not null,
  new_enabled     boolean not null,
  changed_by      uuid references auth.users(id) on delete set null,
  changed_by_role text,
  changed_at      timestamptz not null default now()
);

alter table public.feature_flags_history enable row level security;

create policy "feature_flags_history_read" on public.feature_flags_history
  for select to authenticated
  using (public.has_any_role(array['admin','managing_officer','consultant']));
