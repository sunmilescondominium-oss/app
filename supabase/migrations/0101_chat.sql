-- ─────────────────────────────────────────────────────────────
-- 0101 · Staff Chat
-- Person-to-person messaging between staff with role-restricted
-- access. Canonical role pairs (role_a < role_b alphabetically)
-- control who may talk to whom; admin can toggle pairs on/off.
-- ─────────────────────────────────────────────────────────────

-- Chat messages
create table if not exists chat_messages (
  id            uuid        primary key default gen_random_uuid(),
  sender_id     uuid        not null references auth.users(id) on delete cascade,
  recipient_id  uuid        not null references auth.users(id) on delete cascade,
  body          text        not null check (length(trim(body)) > 0 and length(body) <= 2000),
  read_at       timestamptz,
  created_at    timestamptz not null default now(),
  constraint chat_no_self_message check (sender_id <> recipient_id)
);

create index if not exists chat_messages_recipient_idx on chat_messages (recipient_id, created_at desc);
create index if not exists chat_messages_sender_idx    on chat_messages (sender_id,    created_at desc);

-- Role-to-role permission matrix (canonical pair: role_a < role_b alphabetically)
create table if not exists chat_role_permissions (
  role_a   text    not null,
  role_b   text    not null,
  enabled  boolean not null default true,
  primary key (role_a, role_b),
  constraint canonical_order check (role_a < role_b)
);

-- ── RLS ─────────────────────────────────────────────────────

alter table chat_messages        enable row level security;
alter table chat_role_permissions enable row level security;

-- Users can read messages they sent or received
create policy "chat_messages_read" on chat_messages
  for select using (
    auth.uid() = sender_id or auth.uid() = recipient_id
  );

-- Users can send messages only as themselves
create policy "chat_messages_send" on chat_messages
  for insert with check (auth.uid() = sender_id);

-- Recipients can mark their own messages as read
create policy "chat_messages_mark_read" on chat_messages
  for update using (auth.uid() = recipient_id)
  with check   (auth.uid() = recipient_id);

-- All staff can read the permission matrix
create policy "chat_role_perms_read" on chat_role_permissions
  for select using (auth.role() = 'authenticated');

-- ── Realtime ────────────────────────────────────────────────
alter publication supabase_realtime add table chat_messages;

-- ── Default permission matrix (canonical role_a < role_b) ──
-- Management (admin, consultant, managing_officer, operations_manager) ↔ all roles
-- Peer-level pairs between operational roles
-- Admin can toggle any pair in the Settings → Chat Permissions UI

insert into chat_role_permissions (role_a, role_b, enabled) values
  -- Management ↔ everyone
  ('accounting',             'admin',                    true),
  ('accounting',             'consultant',               true),
  ('accounting',             'managing_officer',         true),
  ('admin',                  'consultant',               true),
  ('admin',                  'electrician',              true),
  ('admin',                  'errand_liaison',           true),
  ('admin',                  'guard',                    true),
  ('admin',                  'hotel_cashier',            true),
  ('admin',                  'hotel_rental_monitoring',  true),
  ('admin',                  'managing_officer',         true),
  ('admin',                  'operations_manager',       true),
  ('admin',                  'owner',                    true),
  ('admin',                  'room_attendant',           true),
  ('admin',                  'utility',                  true),
  ('admin',                  'warehouse_timekeeper',     true),
  ('consultant',             'electrician',              true),
  ('consultant',             'errand_liaison',           true),
  ('consultant',             'guard',                    true),
  ('consultant',             'hotel_cashier',            true),
  ('consultant',             'hotel_rental_monitoring',  true),
  ('consultant',             'managing_officer',         true),
  ('consultant',             'operations_manager',       true),
  ('consultant',             'owner',                    true),
  ('consultant',             'room_attendant',           true),
  ('consultant',             'utility',                  true),
  ('consultant',             'warehouse_timekeeper',     true),
  ('electrician',            'managing_officer',         true),
  ('electrician',            'operations_manager',       true),
  ('errand_liaison',         'managing_officer',         true),
  ('guard',                  'managing_officer',         true),
  ('guard',                  'operations_manager',       true),
  ('hotel_cashier',          'managing_officer',         true),
  ('hotel_cashier',          'operations_manager',       true),
  ('hotel_rental_monitoring','managing_officer',         true),
  ('hotel_rental_monitoring','operations_manager',       true),
  ('managing_officer',       'operations_manager',       true),
  ('managing_officer',       'owner',                    true),
  ('managing_officer',       'room_attendant',           true),
  ('managing_officer',       'utility',                  true),
  ('managing_officer',       'warehouse_timekeeper',     true),
  ('operations_manager',     'room_attendant',           true),
  ('operations_manager',     'utility',                  true),
  ('operations_manager',     'warehouse_timekeeper',     true),
  -- Peer-level pairs
  ('accounting',             'errand_liaison',           true),
  ('accounting',             'hotel_rental_monitoring',  true),
  ('accounting',             'warehouse_timekeeper',     true),
  ('electrician',            'room_attendant',           true),
  ('electrician',            'utility',                  true),
  ('guard',                  'hotel_cashier',            true),
  ('guard',                  'hotel_rental_monitoring',  true),
  ('guard',                  'room_attendant',           true),
  ('hotel_cashier',          'hotel_rental_monitoring',  true),
  ('hotel_cashier',          'room_attendant',           true),
  ('hotel_rental_monitoring','room_attendant',           true),
  ('errand_liaison',         'hotel_rental_monitoring',  true),
  ('room_attendant',         'utility',                  true)
on conflict (role_a, role_b) do nothing;
