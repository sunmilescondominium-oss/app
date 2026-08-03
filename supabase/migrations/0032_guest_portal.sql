-- =============================================================================
-- Migration 0032 — Guest bill portal (QR per stay)
--
-- Each stay gets an opaque portal token encoded into a QR on the receipt.
-- Scanning opens a public per-stay page (bill + live timer) where the guest can
-- request an extension or check out (which flags the stay for the cashier).
-- =============================================================================

alter table public.stays add column if not exists portal_token             text;
alter table public.stays add column if not exists checkout_requested       boolean not null default false;
alter table public.stays add column if not exists extension_requested_hours int;
alter table public.stays add column if not exists guest_request_at          timestamptz;

create unique index if not exists idx_stays_portal_token on public.stays(portal_token) where portal_token is not null;
