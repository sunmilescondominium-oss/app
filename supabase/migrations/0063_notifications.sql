-- In-app notification feed.
-- recipient_role  : all users currently holding this role will see it
-- recipient_user_id : optional — target a single specific user instead/also
create table if not exists public.notifications (
  id                  uuid primary key default gen_random_uuid(),
  kind                text not null,
  title               text not null,
  body                text,
  link                text,
  entity_type         text,
  entity_id           text,
  recipient_role      text,
  recipient_user_id   uuid references public.profiles(id) on delete cascade,
  read_at             timestamptz,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now()
);

create index if not exists notifications_role_unread_idx
  on public.notifications(recipient_role, read_at, created_at desc)
  where read_at is null;

create index if not exists notifications_user_unread_idx
  on public.notifications(recipient_user_id, read_at, created_at desc)
  where read_at is null;
