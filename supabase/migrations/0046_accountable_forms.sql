-- =============================================================================
-- Migration 0046 — Accountable / serialized forms registry.
--
-- Controlled documents (OR, AR, Collection Receipt, Check, Gate Pass…) are
-- registered as booklets with a serial range. Every serial is materialized and
-- tracked (unused → used / cancelled / spoiled / void). Each booklet has a named
-- custodian with a turnover chain, for accountability + reconciliation.
-- =============================================================================

create table if not exists public.form_types (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  name       text not null,
  is_active  boolean not null default true,
  sort_order int not null default 100,
  created_at timestamptz not null default now()
);

insert into public.form_types (code, name, sort_order) values
  ('OR',  'Official Receipt', 10),
  ('AR',  'Acknowledgement Receipt', 20),
  ('CR',  'Collection Receipt', 30),
  ('SI',  'Sales Invoice', 40),
  ('CHK', 'Check', 50),
  ('GP',  'Gate Pass', 60),
  ('PR',  'Provisional / Temporary Receipt', 70)
on conflict (code) do nothing;

create table if not exists public.form_booklets (
  id                uuid primary key default gen_random_uuid(),
  form_type_id      uuid not null references public.form_types(id) on delete restrict,
  booklet_no        text not null,
  prefix            text not null default '',
  serial_from       bigint not null,
  serial_to         bigint not null,
  pad_width         int not null default 0,
  custodian_user_id uuid references auth.users(id) on delete set null,
  custodian_role    text,
  received_from     text,
  received_at       date,
  status            text not null default 'active' check (status in ('active', 'closed')),
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (serial_to >= serial_from)
);
create index if not exists idx_booklets_type on public.form_booklets(form_type_id, created_at desc);

drop trigger if exists trg_form_booklets_updated_at on public.form_booklets;
create trigger trg_form_booklets_updated_at before update on public.form_booklets
  for each row execute function public.set_updated_at();

create table if not exists public.form_serials (
  id               uuid primary key default gen_random_uuid(),
  booklet_id       uuid not null references public.form_booklets(id) on delete cascade,
  form_type_id     uuid not null references public.form_types(id) on delete cascade,
  serial_no        bigint not null,
  serial_label     text not null,
  status           text not null default 'unused' check (status in ('unused', 'used', 'cancelled', 'spoiled', 'void')),
  issued_to        text,
  reference        text,
  amount           numeric(14, 2),
  used_by_user_id  uuid references auth.users(id) on delete set null,
  used_by_role     text,
  used_at          timestamptz,
  remarks          text,
  updated_at       timestamptz not null default now(),
  unique (booklet_id, serial_no)
);
create index if not exists idx_serials_booklet on public.form_serials(booklet_id, serial_no);
create index if not exists idx_serials_status on public.form_serials(status);

-- Custody handover chain (who held the booklet, when).
create table if not exists public.form_custody (
  id          uuid primary key default gen_random_uuid(),
  booklet_id  uuid not null references public.form_booklets(id) on delete cascade,
  from_user_id uuid references auth.users(id) on delete set null, from_role text,
  to_user_id   uuid references auth.users(id) on delete set null, to_role text,
  changed_by  uuid references auth.users(id) on delete set null,
  changed_at  timestamptz not null default now(),
  note        text
);
create index if not exists idx_custody_booklet on public.form_custody(booklet_id, changed_at desc);

-- RLS ------------------------------------------------------------------------
alter table public.form_types    enable row level security;
alter table public.form_booklets enable row level security;
alter table public.form_serials  enable row level security;
alter table public.form_custody  enable row level security;

do $$
declare t text;
begin
  foreach t in array array['form_types', 'form_booklets', 'form_serials', 'form_custody'] loop
    execute format('drop policy if exists %I_sel on public.%I', t, t);
    execute format(
      'create policy %I_sel on public.%I for select to authenticated using (public.has_any_role(array[''owner'',''consultant'',''admin'',''managing_officer'',''accounting'',''hotel_rental_monitoring'',''hotel_cashier'']))',
      t, t);
  end loop;
end $$;
