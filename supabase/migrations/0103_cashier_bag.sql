-- Migration 0103: cashier bag denominations + session-based collection grouping
-- Adds bag counting to hotel_cashier_sessions, stamps cashier_session_id on collections
-- and transmittals, and creates an audit trail for monitoring overrides.

-- 1. Extend hotel_cashier_sessions with bag columns
ALTER TABLE public.hotel_cashier_sessions
  ADD COLUMN IF NOT EXISTS bag_denominations jsonb,
  ADD COLUMN IF NOT EXISTS bagged_at timestamptz,
  ADD COLUMN IF NOT EXISTS bagged_by uuid references auth.users(id) on delete set null,
  ADD COLUMN IF NOT EXISTS bag_skipped boolean not null default false,
  ADD COLUMN IF NOT EXISTS bag_skipped_reason text;

-- 2. Stamp cashier_session_id on collections
ALTER TABLE public.collections
  ADD COLUMN IF NOT EXISTS cashier_session_id uuid references public.hotel_cashier_sessions(id) on delete set null;

CREATE INDEX IF NOT EXISTS idx_collections_cashier_session
  ON public.collections(cashier_session_id);

-- 3. Stamp cashier_session_id + denomination_source on transmittals
ALTER TABLE public.transmittals
  ADD COLUMN IF NOT EXISTS cashier_session_id uuid references public.hotel_cashier_sessions(id) on delete set null,
  ADD COLUMN IF NOT EXISTS denomination_source text
    check (denomination_source in ('cashier_bag', 'monitoring_count'));

CREATE INDEX IF NOT EXISTS idx_transmittals_cashier_session
  ON public.transmittals(cashier_session_id);

-- 4. Audit table for monitoring denomination overrides
CREATE TABLE IF NOT EXISTS public.transmittal_bag_audit (
  id uuid primary key default gen_random_uuid(),
  transmittal_id uuid not null references public.transmittals(id) on delete cascade,
  cashier_denominations jsonb,
  monitoring_denominations jsonb not null,
  variance jsonb,
  reason text not null,
  noted_by uuid references auth.users(id) on delete set null,
  noted_at timestamptz not null default now()
);

ALTER TABLE public.transmittal_bag_audit ENABLE ROW LEVEL SECURITY;

-- Supervisors/monitoring can read and insert audit records
CREATE POLICY "transmittal_bag_audit_select" ON public.transmittal_bag_audit
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.role_assignments ra
      WHERE ra.user_id = auth.uid()
        AND ra.role_key IN ('hotel_rental_monitoring','admin','managing_officer','consultant','accounting')
    )
  );

CREATE POLICY "transmittal_bag_audit_insert" ON public.transmittal_bag_audit
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.role_assignments ra
      WHERE ra.user_id = auth.uid()
        AND ra.role_key IN ('hotel_rental_monitoring','admin','managing_officer','consultant','accounting')
    )
  );
