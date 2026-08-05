-- =============================================================================
-- Migration 0047 — Registered business entities + BIR details on booklets.
--
-- OR/SI (and other accountable forms) are printed under a BIR-registered
-- business with an Authority to Print (ATP). The company runs multiple
-- registered businesses, so booklets are tagged to a business entity and carry
-- their BIR ATP / printer reference. Add entities freely — not hardcoded.
-- =============================================================================

create table if not exists public.business_entities (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  trade_name         text,
  tin                text,                 -- BIR Taxpayer Identification Number
  bir_rdo            text,                 -- Revenue District Office code
  registered_address text,
  is_active          boolean not null default true,
  sort_order         int not null default 100,
  created_at         timestamptz not null default now()
);

-- Which registered business a booklet belongs to + its Authority-to-Print info.
alter table public.form_booklets add column if not exists business_entity_id   uuid references public.business_entities(id) on delete set null;
alter table public.form_booklets add column if not exists bir_atp_no           text;   -- Authority to Print / permit number
alter table public.form_booklets add column if not exists bir_atp_date         date;
alter table public.form_booklets add column if not exists printer_name         text;
alter table public.form_booklets add column if not exists printer_accreditation text;

alter table public.business_entities enable row level security;
drop policy if exists business_entities_sel on public.business_entities;
create policy business_entities_sel on public.business_entities for select to authenticated
  using (public.has_any_role(array['owner', 'consultant', 'admin', 'managing_officer', 'accounting', 'hotel_rental_monitoring', 'hotel_cashier']));
