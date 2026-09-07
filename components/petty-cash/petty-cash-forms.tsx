"use client";

import { useActionState } from "react";
import {
  loadPettyCashFund,
  recordPettyCashDisbursement,
  savePettyCashFundSettings,
} from "@/lib/petty-cash/actions";
import type { PettyCashFund } from "@/lib/petty-cash/queries";
import type { ExpenseCategory, ExpenseVendor } from "@/lib/expenses/queries";

type AR = { ok: true } | { ok: false; error: string } | undefined;

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());

// ---------------------------------------------------------------------------
// Load fund from bank
// ---------------------------------------------------------------------------

export function LoadFundForm({
  funds,
  accounts,
}: {
  funds: PettyCashFund[];
  accounts: { id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState<AR, FormData>(loadPettyCashFund, undefined);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Petty Cash Fund *</label>
        <select name="fund_id" required className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm">
          <option value="">— select fund —</option>
          {funds.map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Bank Account (withdrawal source) *</label>
        <select name="bank_account_id" required className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm">
          <option value="">— select account —</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Amount (₱) *</label>
        <input type="number" name="amount" min="0.01" step="0.01" required placeholder="0.00" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm tabular-nums" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Description</label>
        <input type="text" name="description" placeholder="e.g. Weekly petty cash replenishment" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
      </div>
      {state && !state.ok && <p className="sm:col-span-2 text-sm text-rose-600">{state.error}</p>}
      {state?.ok && <p className="sm:col-span-2 text-sm text-emerald-600">Fund loaded successfully.</p>}
      <div className="sm:col-span-2">
        <button disabled={pending} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          {pending ? "Loading…" : "Load fund"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Disbursement form
// ---------------------------------------------------------------------------

export function DisbursementForm({
  funds,
  categories,
  vendors,
}: {
  funds: PettyCashFund[];
  categories: ExpenseCategory[];
  vendors: ExpenseVendor[];
}) {
  const [state, action, pending] = useActionState<AR, FormData>(recordPettyCashDisbursement, undefined);

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Petty Cash Fund *</label>
        <select name="fund_id" required className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm">
          <option value="">— select fund —</option>
          {funds.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} — ₱{f.balance.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Date *</label>
        <input type="date" name="expense_date" defaultValue={today()} required className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-stone-600">Description *</label>
        <input type="text" name="description" required placeholder="What was this for?" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Category</label>
        <select name="expense_category_id" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm">
          <option value="">— choose —</option>
          {categories.filter((c) => c.is_active).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Vendor / Payee</label>
        <select name="expense_vendor_id" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm">
          <option value="">— choose —</option>
          {vendors.filter((v) => v.is_active).map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Amount (₱) *</label>
        <input type="number" name="amount" min="0.01" step="0.01" required placeholder="0.00" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm tabular-nums" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">OR / Receipt number</label>
        <input type="text" name="or_number" placeholder="e.g. 1234" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-stone-600">Remarks</label>
        <input type="text" name="remarks" placeholder="Optional notes" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
      </div>
      {state && !state.ok && <p className="sm:col-span-2 text-sm text-rose-600">{state.error}</p>}
      {state?.ok && <p className="sm:col-span-2 text-sm text-emerald-600">Disbursement recorded. PCV number auto-assigned.</p>}
      <div className="sm:col-span-2">
        <button disabled={pending} className="rounded-xl bg-rose-600 px-5 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
          {pending ? "Recording…" : "Record disbursement"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Fund settings form
// ---------------------------------------------------------------------------

export function FundSettingsForm({
  fund,
  staffOptions,
}: {
  fund: PettyCashFund;
  staffOptions: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<AR, FormData>(savePettyCashFundSettings, undefined);

  return (
    <form action={action} className="flex flex-wrap items-end gap-4">
      <input type="hidden" name="fund_id" value={fund.id} />
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">PCV prefix</label>
        <input type="text" name="pcv_prefix" defaultValue={fund.pcv_prefix} required className="w-28 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Low-balance alert threshold (₱)</label>
        <input type="number" name="low_balance_threshold" defaultValue={fund.low_balance_threshold} min="0" step="100" className="w-40 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm tabular-nums" />
      </div>
      {staffOptions.length > 0 && (
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">Custodian</label>
          <select name="custodian_user_id" defaultValue={fund.custodian_user_id ?? ""} className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm">
            <option value="">— none assigned —</option>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}
      {state && !state.ok && <p className="w-full text-xs text-rose-600">{state.error}</p>}
      {state?.ok && <p className="w-full text-xs text-emerald-600">Fund settings saved.</p>}
      <button disabled={pending} className="rounded-xl bg-stone-800 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-50">
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}
