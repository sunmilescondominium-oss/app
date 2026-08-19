-- Migration 0080: Government discount type on stays (PWD / Senior Citizen)
-- PH law mandates 20% discount for both categories.
-- Stored separately from promo discounts for audit/reporting clarity.

alter table public.stays
  add column if not exists discount_type text
    check (discount_type in ('pwd', 'senior_citizen'));
