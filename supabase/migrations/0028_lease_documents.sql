-- =============================================================================
-- Migration 0028 — Renter details + document checklist (leases)
-- =============================================================================

alter table public.leases add column if not exists permanent_address text;
alter table public.leases add column if not exists email             text;
alter table public.leases add column if not exists emergency_contact text;
alter table public.leases add column if not exists emergency_phone   text;
alter table public.leases add column if not exists motor_plate       text;
alter table public.leases add column if not exists lease_type        text;  -- new | renewal | extension | transfer
alter table public.leases add column if not exists transferred_from  text;

create table if not exists public.lease_documents (
  id         uuid primary key default gen_random_uuid(),
  lease_id   uuid not null references public.leases(id) on delete cascade,
  doc_type   text not null,
  submitted  boolean not null default false,
  file_path  text,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (lease_id, doc_type)
);
create index if not exists idx_lease_docs_lease on public.lease_documents(lease_id);

drop trigger if exists trg_lease_docs_updated_at on public.lease_documents;
create trigger trg_lease_docs_updated_at before update on public.lease_documents
  for each row execute function public.set_updated_at();

alter table public.lease_documents enable row level security;
drop policy if exists lease_documents_all on public.lease_documents;
create policy lease_documents_all on public.lease_documents for all to authenticated
  using (public.has_any_role(array['admin', 'managing_officer', 'operations_manager', 'accounting', 'hotel_rental_monitoring']))
  with check (public.has_any_role(array['admin', 'managing_officer', 'operations_manager', 'accounting', 'hotel_rental_monitoring']));
