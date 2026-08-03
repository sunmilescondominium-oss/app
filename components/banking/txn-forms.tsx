"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { recordDeposit, releaseCheck, recordEntry, saveReconciliation, type ActionResult } from "@/app/(app)/banking/actions";
import { peso } from "./peso";

const cls = "rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";
const today = () => new Date().toISOString().slice(0, 10);

export interface TxOption { id: string; label: string }

export function DepositForm({ accountId, transmittals }: { accountId: string; transmittals: TxOption[] }) {
  const router = useRouter();
  const [state, act, pending] = useActionState<ActionResult | undefined, FormData>(recordDeposit, undefined);
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  return (
    <form action={act} className="grid gap-2 sm:grid-cols-2">
      <input type="hidden" name="bank_account_id" value={accountId} />
      <label className="text-xs font-medium text-slate-500">Date<input name="txn_date" type="date" defaultValue={today()} className={`${cls} mt-1 w-full`} /></label>
      <label className="text-xs font-medium text-slate-500">Amount<input name="amount" type="number" step="0.01" min="0" required className={`${cls} mt-1 w-full`} /></label>
      <label className="text-xs font-medium text-slate-500">Deposit slip ref<input name="reference" className={`${cls} mt-1 w-full`} /></label>
      <label className="text-xs font-medium text-slate-500">Source (role / line)<input name="counterparty" placeholder="e.g. Hotel collections" className={`${cls} mt-1 w-full`} /></label>
      <label className="text-xs font-medium text-slate-500 sm:col-span-2">Link to transmittal (optional)
        <select name="transmittal_id" defaultValue="" className={`${cls} mt-1 w-full`}>
          <option value="">— none —</option>
          {transmittals.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </label>
      <label className="text-xs font-medium text-slate-500 sm:col-span-2">Memo<input name="memo" className={`${cls} mt-1 w-full`} /></label>
      <div className="flex items-center gap-2 sm:col-span-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">{pending ? "…" : "Record deposit"}</button>
        {state && !state.ok && <p className="text-sm text-red-700">{state.error}</p>}
      </div>
    </form>
  );
}

export function CheckForm({ accountId, available }: { accountId: string; available: number }) {
  const router = useRouter();
  const [state, act, pending] = useActionState<ActionResult | undefined, FormData>(releaseCheck, undefined);
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  return (
    <form action={act} className="grid gap-2 sm:grid-cols-2">
      <input type="hidden" name="bank_account_id" value={accountId} />
      <p className="text-xs text-slate-500 sm:col-span-2">Available to release: <span className="font-semibold tabular-nums text-slate-800">{peso(available)}</span></p>
      <label className="text-xs font-medium text-slate-500">Date<input name="txn_date" type="date" defaultValue={today()} className={`${cls} mt-1 w-full`} /></label>
      <label className="text-xs font-medium text-slate-500">Amount<input name="amount" type="number" step="0.01" min="0" required className={`${cls} mt-1 w-full`} /></label>
      <label className="text-xs font-medium text-slate-500">Check no.<input name="reference" className={`${cls} mt-1 w-full`} /></label>
      <label className="text-xs font-medium text-slate-500">Payee (role / vendor)<input name="counterparty" required placeholder="e.g. Utility provider" className={`${cls} mt-1 w-full`} /></label>
      <label className="text-xs font-medium text-slate-500 sm:col-span-2">Memo / purpose<input name="memo" className={`${cls} mt-1 w-full`} /></label>
      <div className="flex items-center gap-2 sm:col-span-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">{pending ? "…" : "Release check"}</button>
        {state && !state.ok && <p className="text-sm text-red-700">{state.error}</p>}
      </div>
    </form>
  );
}

const ENTRY_KINDS = [
  { v: "withdrawal", l: "Withdrawal (out)" },
  { v: "transfer", l: "Transfer out" },
  { v: "bank_charge", l: "Bank charge" },
  { v: "interest", l: "Interest (in)" },
  { v: "adjustment", l: "Adjustment (out)" },
];

export function EntryForm({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [state, act, pending] = useActionState<ActionResult | undefined, FormData>(recordEntry, undefined);
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  return (
    <form action={act} className="grid gap-2 sm:grid-cols-2">
      <input type="hidden" name="bank_account_id" value={accountId} />
      <label className="text-xs font-medium text-slate-500">Type
        <select name="kind" className={`${cls} mt-1 w-full`}>{ENTRY_KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}</select>
      </label>
      <label className="text-xs font-medium text-slate-500">Amount<input name="amount" type="number" step="0.01" min="0" required className={`${cls} mt-1 w-full`} /></label>
      <label className="text-xs font-medium text-slate-500">Date<input name="txn_date" type="date" defaultValue={today()} className={`${cls} mt-1 w-full`} /></label>
      <label className="text-xs font-medium text-slate-500">Reference<input name="reference" className={`${cls} mt-1 w-full`} /></label>
      <label className="text-xs font-medium text-slate-500 sm:col-span-2">Memo<input name="memo" className={`${cls} mt-1 w-full`} /></label>
      <div className="flex items-center gap-2 sm:col-span-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-slate-700 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">{pending ? "…" : "Record entry"}</button>
        {state && !state.ok && <p className="text-sm text-red-700">{state.error}</p>}
      </div>
    </form>
  );
}

export function ReconcileForm({ accountId, clearedBalance }: { accountId: string; clearedBalance: number }) {
  const router = useRouter();
  const [state, act, pending] = useActionState<ActionResult | undefined, FormData>(saveReconciliation, undefined);
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  return (
    <form action={act} className="grid gap-2 sm:grid-cols-2">
      <input type="hidden" name="bank_account_id" value={accountId} />
      <p className="text-xs text-slate-500 sm:col-span-2">Book (cleared) balance: <span className="font-semibold tabular-nums text-slate-800">{peso(clearedBalance)}</span> — this should match the bank statement's closing balance.</p>
      <label className="text-xs font-medium text-slate-500">Statement date<input name="statement_date" type="date" defaultValue={today()} required className={`${cls} mt-1 w-full`} /></label>
      <label className="text-xs font-medium text-slate-500">Statement closing balance<input name="statement_balance" type="number" step="0.01" required className={`${cls} mt-1 w-full`} /></label>
      <label className="text-xs font-medium text-slate-500 sm:col-span-2">Note<input name="note" className={`${cls} mt-1 w-full`} /></label>
      <div className="flex items-center gap-2 sm:col-span-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{pending ? "…" : "Save reconciliation"}</button>
        {state && !state.ok && <p className="text-sm text-red-700">{state.error}</p>}
      </div>
    </form>
  );
}
