-- =============================================================================
-- Migration 0050 — For now only OR and SI (with ATP) are BIR-reportable.
-- Everything else defaults to internal. Accounting can still toggle any type
-- from the Form types panel later.
-- =============================================================================

update public.form_types set bir_reportable = true  where code in ('OR', 'SI');
update public.form_types set bir_reportable = false where code not in ('OR', 'SI');
