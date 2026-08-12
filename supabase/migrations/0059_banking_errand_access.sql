-- =============================================================================
-- Migration 0059 — Extend banking read access to errand_liaison
--
-- Errand/liaison staff carry cash to the bank for deposit. They need to be
-- able to:
--   · see the list of active bank accounts (choose deposit target)
--   · view the passbook / ledger for the account they are depositing into
--
-- Reconciliation data (bank_reconciliations) stays accounting/admin only.
-- Write access stays unchanged: accounting + admin only.
-- =============================================================================

do $$
declare t text;
begin
  -- bank_accounts and bank_transactions: extend SELECT to errand_liaison
  foreach t in array array['bank_accounts', 'bank_transactions'] loop
    execute format('drop policy if exists %I_select on public.%I', t, t);
    execute format(
      $f$create policy %I_select on public.%I for select to authenticated
        using (public.has_any_role(array[
          'admin', 'accounting', 'managing_officer', 'owner', 'consultant', 'errand_liaison'
        ]))$f$, t, t);
  end loop;

  -- bank_reconciliations: no change (stays restricted to accounting/admin/oversight)
  execute 'drop policy if exists bank_reconciliations_select on public.bank_reconciliations';
  execute $f$create policy bank_reconciliations_select on public.bank_reconciliations
    for select to authenticated
    using (public.has_any_role(array[
      'admin', 'accounting', 'managing_officer', 'owner', 'consultant'
    ]))$f$;
end $$;
