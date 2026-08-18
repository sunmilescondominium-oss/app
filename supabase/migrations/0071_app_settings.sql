-- App-wide key/value settings (text values; for booleans use feature_flags).
create table if not exists public.app_settings (
  key         text primary key,
  value       text not null,
  label       text not null,
  description text,
  updated_by  uuid references auth.users(id) on delete set null,
  updated_at  timestamptz not null default now()
);

alter table public.app_settings enable row level security;

-- All authenticated staff can read settings.
create policy "app_settings_read" on public.app_settings
  for select to authenticated using (true);

-- Only admin / managing_officer can write.
create policy "app_settings_write" on public.app_settings
  for all to authenticated
  using  (public.has_any_role(array['admin','managing_officer']))
  with check (public.has_any_role(array['admin','managing_officer']));

-- Seed the timezone setting.
insert into public.app_settings (key, value, label, description) values
  ('timezone', 'Asia/Manila', 'Operating Timezone',
   'IANA timezone name (e.g. Asia/Manila, Asia/Singapore). All timestamps displayed in the app use this zone.')
on conflict (key) do nothing;
