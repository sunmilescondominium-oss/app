"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { saveAccount, type ActionResult } from "@/app/(app)/banking/actions";
import { ACCOUNT_TYPE_LABEL, type AccountType, type BankAccount } from "@/lib/banking/types";

const cls = "rounded-lg border border-stone-300 px-2.5 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200";
const TYPES = Object.keys(ACCOUNT_TYPE_LABEL) as AccountType[];

export function AccountForm({ account }: { account?: BankAccount }) {
  const router = useRouter();
  const [open, setOpen] = useState(!!account);
  const [state, act, pending] = useActionState<ActionResult | undefined, FormData>(saveAccount, undefined);
  useEffect(() => { if (state?.ok) { router.refresh(); if (!account) setOpen(false); } }, [state, router, account]);

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100">
        + Add bank account
      </button>
    );
  }

  return (
    <form action={act} className="grid gap-2 rounded-2xl border border-stone-200 bg-white p-4 sm:grid-cols-2">
      {account && <input type="hidden" name="id" value={account.id} />}
      <label className="text-xs font-medium text-stone-500 sm:col-span-2">
        Account label (purpose-based)
        <input name="label" required defaultValue={account?.label} placeholder="Collections – Main" className={`${cls} mt-1 w-full`} />
      </label>
      <label className="text-xs font-medium text-stone-500">
        Bank name
        <input name="bank_name" defaultValue={account?.bank_name ?? ""} placeholder="e.g. BDO" className={`${cls} mt-1 w-full`} />
      </label>
      <label className="text-xs font-medium text-stone-500">
        Account no. (masked)
        <input name="account_no_masked" defaultValue={account?.account_no_masked ?? ""} placeholder="•••• 1234" className={`${cls} mt-1 w-full`} />
      </label>
      <label className="text-xs font-medium text-stone-500">
        Type
        <select name="account_type" defaultValue={account?.account_type ?? "collection"} className={`${cls} mt-1 w-full`}>
          {TYPES.map((t) => <option key={t} value={t}>{ACCOUNT_TYPE_LABEL[t]}</option>)}
        </select>
      </label>
      <label className="text-xs font-medium text-stone-500">
        Opening balance
        <input name="opening_balance" type="number" step="0.01" defaultValue={account?.opening_balance ?? 0} className={`${cls} mt-1 w-full`} />
      </label>
      {account && (
        <label className="flex items-center gap-2 text-sm text-stone-600 sm:col-span-2">
          <input type="checkbox" name="is_active" defaultChecked={account.is_active} /> Active
        </label>
      )}
      <div className="flex items-center gap-2 sm:col-span-2">
        <button type="submit" disabled={pending} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
          {pending ? "Saving…" : account ? "Save changes" : "Create account"}
        </button>
        {!account && <button type="button" onClick={() => setOpen(false)} className="text-sm text-stone-500 hover:underline">Cancel</button>}
        {state && !state.ok && <p className="text-sm text-red-700">{state.error}</p>}
      </div>
    </form>
  );
}
