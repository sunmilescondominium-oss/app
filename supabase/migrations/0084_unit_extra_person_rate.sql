-- Migration 0084: per-room extra person rate
-- Replaces the single global hotel_extra_settings rate with a per-unit rate.

alter table public.units
  add column if not exists extra_person_rate numeric(12,2) not null default 0;
