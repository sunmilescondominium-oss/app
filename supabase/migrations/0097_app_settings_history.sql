-- Audit log for app_settings changes (archive before every overwrite).
create table if not exists public.app_settings_history (
  id          bigserial primary key,
  key         text not null,
  old_value   text,
  new_value   text not null,
  changed_by  uuid references auth.users(id) on delete set null,
  changed_at  timestamptz not null default now()
);

alter table public.app_settings_history enable row level security;

-- Admin / managing_officer / consultant can read history; writes are admin-client-only.
create policy "app_settings_history_read" on public.app_settings_history
  for select to authenticated
  using (public.has_any_role(array['admin','managing_officer','consultant']));

-- Extend the settings write policy to include consultant (admin client bypasses RLS
-- anyway, but keeping the policy consistent with application logic is good hygiene).
drop policy if exists "app_settings_write" on public.app_settings;
create policy "app_settings_write" on public.app_settings
  for all to authenticated
  using  (public.has_any_role(array['admin','managing_officer','consultant']))
  with check (public.has_any_role(array['admin','managing_officer','consultant']));
