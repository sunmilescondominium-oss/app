-- =============================================================================
-- Migration 0022 — Cashiering: denomination counts, online proof, discounts
--
--   • collections: reference no + proof screenshot + payment-confirmed flag for
--     online/GCash payments; discount amount + coupon code.
--   • transmittals: a PHP bill/coin denomination breakdown (jsonb) and the
--     counted cash total it sums to — the basis for the transmitted cash.
--   • Proof screenshots live in a private bucket (created in the seed).
-- =============================================================================

alter table public.collections add column if not exists reference_no      text;
alter table public.collections add column if not exists proof_path        text;
alter table public.collections add column if not exists payment_confirmed boolean not null default false;
alter table public.collections add column if not exists discount_amount   numeric(14, 2) not null default 0;
alter table public.collections add column if not exists coupon_code       text;

alter table public.transmittals add column if not exists denomination_counts jsonb;
alter table public.transmittals add column if not exists counted_cash        numeric(14, 2);
