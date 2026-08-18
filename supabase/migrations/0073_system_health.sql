-- System error log: stores errors from crons, actions, and API routes.
create table if not exists public.system_errors (
  id         uuid primary key default gen_random_uuid(),
  context    text not null,   -- e.g. "cron:alarm-check", "action:saveCollection"
  message    text not null,
  detail     text,
  created_at timestamptz not null default now()
);
alter table public.system_errors enable row level security;
-- Only service role reads/writes (health page uses admin client).

create index if not exists system_errors_created_at
  on public.system_errors (created_at desc);

-- Auto-prune errors older than 7 days.
create or replace function public.prune_system_errors() returns void
  language sql security definer as $$
    delete from public.system_errors where created_at < now() - interval '7 days';
  $$;

-- DB size helper — returns raw bytes so the app can compute the percentage.
create or replace function public.get_db_size_bytes() returns bigint
  language sql security definer stable as $$
    select pg_database_size(current_database());
  $$;

-- Table size helper — returns bytes for a given table (for future use).
create or replace function public.get_table_size_bytes(tbl text) returns bigint
  language sql security definer stable as $$
    select pg_total_relation_size(tbl);
  $$;
