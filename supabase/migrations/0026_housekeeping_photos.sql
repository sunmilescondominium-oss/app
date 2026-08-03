-- =============================================================================
-- Migration 0026 — Housekeeping completion photos
--
-- Cleaners photograph the room after cleaning (bed, toilet, room, etc.). Paths
-- to those photos (private "housekeeping-photos" bucket) are stored on the task.
-- =============================================================================

alter table public.housekeeping_tasks add column if not exists photos jsonb not null default '[]'::jsonb;
