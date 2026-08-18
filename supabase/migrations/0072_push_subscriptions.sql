-- Push subscriptions: one row per device that opted in to push notifications.
-- endpoint is unique (browsers recycle endpoints on re-subscribe).
create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  constraint push_subscriptions_endpoint_key unique (endpoint)
);
alter table public.push_subscriptions enable row level security;

-- Users can read / insert / delete their own subscriptions.
create policy "push_subs_select" on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());
create policy "push_subs_insert" on public.push_subscriptions
  for insert to authenticated with check (user_id = auth.uid());
create policy "push_subs_delete" on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid());

-- Deduplication log: prevents repeat pushes within a cooldown window.
-- event_key examples: 'hotel_overdue:UUID', 'hk_start:UUID', 'hk_finish:UUID'
create table if not exists public.push_notifications_log (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  sent_at   timestamptz not null default now()
);
alter table public.push_notifications_log enable row level security;
-- Only the service role (cron) writes here; no RLS needed for users.

create index if not exists push_notifications_log_lookup
  on public.push_notifications_log (user_id, event_key, sent_at desc);

-- Auto-prune log rows older than 24 h (prevents unbounded growth).
create or replace function public.prune_push_log() returns void
  language sql security definer as $$
    delete from public.push_notifications_log
    where sent_at < now() - interval '24 hours';
  $$;
