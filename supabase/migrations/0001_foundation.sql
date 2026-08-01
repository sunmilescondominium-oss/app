-- =============================================================================
-- Sun Miles Property Management System
-- Migration 0001 — Foundation (M0)
--
-- Roles, profiles, user_roles, audit_log + RLS helper functions.
-- Prime directive: role-based, never person-based — every permission keys off
-- role_key, and reassigning a person is a single row change in user_roles.
--
-- This file is idempotent (safe to re-run).
-- =============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- updated_at helper
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- roles — lookup table so a new role is an INSERT, never a migration.
-- ---------------------------------------------------------------------------
create table if not exists public.roles (
  role_key    text primary key,
  label       text not null,
  description text,
  is_staff    boolean not null default true,  -- false = external self-service role
  sort_order  integer not null default 100,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles — 1:1 with auth.users. NO personal name: only a display label the
-- user sets for themselves.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_label text not null default 'New Member',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- user_roles — many-to-many. A person may hold more than one role.
-- ---------------------------------------------------------------------------
create table if not exists public.user_roles (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role_key   text not null references public.roles(role_key) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (user_id, role_key)
);

create index if not exists idx_user_roles_role_key on public.user_roles(role_key);

-- ---------------------------------------------------------------------------
-- audit_log — write on every mutation. Actor recorded BY ROLE, never by name.
-- ---------------------------------------------------------------------------
create table if not exists public.audit_log (
  id            uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_roles   text[] not null default '{}',
  action        text not null,   -- 'create' | 'update' | 'delete' | ...
  entity        text not null,   -- table / module name
  entity_id     text,            -- affected row id (text: may be uuid or composite)
  diff          jsonb,
  created_at    timestamptz not null default now()
);

create index if not exists idx_audit_log_entity     on public.audit_log(entity, entity_id);
create index if not exists idx_audit_log_created_at on public.audit_log(created_at desc);

-- ---------------------------------------------------------------------------
-- RLS helper functions.
-- SECURITY DEFINER so they read user_roles WITHOUT recursing into user_roles'
-- own RLS policies. Used by this and every later module's policies.
-- ---------------------------------------------------------------------------
create or replace function public.current_role_keys()
returns text[]
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(array_agg(ur.role_key), '{}')
  from public.user_roles ur
  where ur.user_id = auth.uid();
$$;

create or replace function public.has_role(target_role text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role_key = target_role
  );
$$;

create or replace function public.has_any_role(target_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.user_roles ur
    where ur.user_id = auth.uid() and ur.role_key = any(target_roles)
  );
$$;

-- ---------------------------------------------------------------------------
-- Auto-create a profile row when a new auth user is created.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_label)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data ->> 'display_label', ''), 'New Member')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.roles      enable row level security;
alter table public.profiles   enable row level security;
alter table public.user_roles enable row level security;
alter table public.audit_log  enable row level security;

-- roles: any authenticated user may read the catalog; no client writes.
drop policy if exists roles_select_authenticated on public.roles;
create policy roles_select_authenticated
  on public.roles for select
  to authenticated
  using (true);

-- profiles: a user may read and update only their own profile.
-- TODO(client-confirm): restrict UPDATE to the display_label column only
-- (column-level grant or a trigger) once back-office admin editing lands.
drop policy if exists profiles_select_self on public.profiles;
create policy profiles_select_self
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- user_roles: a user may read only their own role assignments.
-- Assignment (writes) happens server-side with the service role / a future
-- admin module — never from the browser.
drop policy if exists user_roles_select_self on public.user_roles;
create policy user_roles_select_self
  on public.user_roles for select
  to authenticated
  using (user_id = auth.uid());

-- audit_log: no direct client access. RLS enabled with NO permissive policy
-- => denied for anon/authenticated; the server writes with the service role.
