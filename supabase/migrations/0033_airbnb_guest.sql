-- =============================================================================
-- Migration 0033 — Airbnb guest bill portal (QR per booking)
--
-- Airbnb bookings (leases) get a portal token → public per-booking page with the
-- bill (paid-in-advance rate + any extra charges), a countdown to checkout, and
-- extension / check-out requests that flag the booking for monitoring.
-- =============================================================================

alter table public.leases add column if not exists portal_token        text;
alter table public.leases add column if not exists checkout_requested  boolean not null default false;
alter table public.leases add column if not exists extension_requested text;
alter table public.leases add column if not exists guest_request_at     timestamptz;

create unique index if not exists idx_leases_portal_token on public.leases(portal_token) where portal_token is not null;
