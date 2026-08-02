-- =============================================================================
-- Migration 0018 — Kiosk QR badge login
--
-- profiles.qr_token: an opaque per-employee token encoded into a printable QR
-- badge. Scanning it at the kiosk overrides manual ID + passcode entry (the
-- passcode is never encoded in the QR). Regenerable from the HR screen.
-- =============================================================================

alter table public.profiles add column if not exists qr_token text;
create unique index if not exists idx_profiles_qr_token on public.profiles(qr_token) where qr_token is not null;
