-- =============================================================================
-- Migration 0040 — doc_photos can hold short video clips too
-- =============================================================================

alter table public.doc_photos
  add column if not exists media_type text not null default 'image'
  check (media_type in ('image', 'video'));
