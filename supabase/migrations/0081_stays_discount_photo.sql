-- Migration 0081: Discount ID photo storage on stays
-- Required for PWD / Senior Citizen audit trail (PH Data Privacy Act compliance).
-- Photo path references Supabase storage bucket "discount-id-photos".
-- Expires 48 hours after capture; cleanup cron nulls both columns and removes from storage.

alter table public.stays
  add column if not exists discount_id_photo_path text,
  add column if not exists discount_id_photo_expires_at timestamptz;
