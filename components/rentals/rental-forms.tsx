"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  startLease,
  endLease,
  extendLease,
  addMeterReading,
  createDue,
  markDuePaid,
  type ActionResult,
} from "@/app/(app)/rentals/actions";
import { UTILITY_TYPES, RENTAL_DUE_CATEGORIES, BILLING_CYCLES } from "@/lib/config";

type Unit = { id: string; label: string; businessLine: string };
const cls = "rounded-lg border border-stone-300 px-2.5 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

function useRefreshingAction(fn: (p: ActionResult | undefined, fd: FormData) => Promise<ActionResult>) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(fn, undefined);
  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);
  return { state, action, pending };
}

export function StartLeaseForm({ units }: { units: Unit[] }) {
  const { state, action, pending } = useRefreshingAction(startLease);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-2xl border border-stone-200 bg-white p-4">
      <select name="unit_id" required className={cls} defaultValue="">
        <option value="" disabled>Unit…</option>
        {units.map((u) => (
          <option key={u.id} value={u.id}>{u.label} ({u.businessLine})</option>
        ))}
      </select>
      <input name="tenant_label" placeholder="Tenant / guest" required className={cls} />
      <input name="contact" placeholder="Contact" className={cls} />
      <input name="start_date" type="date" className={cls} title="Start date" />
      <input name="end_at" type="datetime-local" className={cls} title="Checkout / lease end (Airbnb)" />
      <input name="rent_amount" type="number" step="0.01" min="0" placeholder="Rent ₱" className={`${cls} w-24`} />
      <select name="billing_cycle" defaultValue="monthly" className={cls}>
        {BILLING_CYCLES.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
      </select>
      <input name="deposit" type="number" step="0.01" min="0" placeholder="Deposit ₱" className={`${cls} w-24`} />
      <button type="submit" disabled={pending} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
        {pending ? "Saving…" : "Start lease / booking"}
      </button>
      {state && !state.ok && <p className="w-full text-sm text-red-700">{state.error}</p>}
    </form>
  );
}

export function LeaseActions({ leaseId, canExtend }: { leaseId: string; canExtend: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function end() {
    if (!window.confirm("End this lease / check out?")) return;
    setBusy(true);
    const r = await endLease(leaseId);
    setBusy(false);
    if (!r.ok) return window.alert(r.error);
    router.refresh();
  }
  async function extend() {
    const v = window.prompt("New checkout / end (YYYY-MM-DDTHH:MM):");
    if (!v) return;
    setBusy(true);
    const r = await extendLease(leaseId, v);
    setBusy(false);
    if (!r.ok) return window.alert(r.error);
    router.refresh();
  }
  return (
    <div className="flex justify-end gap-2">
      {canExtend && <button type="button" onClick={extend} disabled={busy} className="text-xs font-medium text-sky-700 hover:underline">extend</button>}
      <button type="button" onClick={end} disabled={busy} className="text-xs font-medium text-rose-600 hover:underline">end</button>
    </div>
  );
}

export function MeterForm({ units }: { units: Unit[] }) {
  const { state, action, pending } = useRefreshingAction(addMeterReading);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-2xl border border-stone-200 bg-white p-4">
      <select name="unit_id" required className={cls} defaultValue="">
        <option value="" disabled>Unit…</option>
        {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
      </select>
      <select name="utility" defaultValue="electric" className={cls}>
        {UTILITY_TYPES.map((u) => <option key={u.key} value={u.key}>{u.label}</option>)}
      </select>
      <input name="reading" type="number" step="0.01" min="0" placeholder="Reading" required className={`${cls} w-28`} />
      <input name="read_on" type="date" className={cls} />
      <button type="submit" disabled={pending} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
        {pending ? "Saving…" : "Add reading"}
      </button>
      {state && !state.ok && <p className="w-full text-sm text-red-700">{state.error}</p>}
    </form>
  );
}

export function DueForm({ units }: { units: Unit[] }) {
  const { state, action, pending } = useRefreshingAction(createDue);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 rounded-2xl border border-stone-200 bg-white p-4">
      <select name="unit_id" required className={cls} defaultValue="">
        <option value="" disabled>Unit…</option>
        {units.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
      </select>
      <select name="category" defaultValue="rent" className={cls}>
        {RENTAL_DUE_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>
      <input name="amount" type="number" step="0.01" min="0" placeholder="Amount ₱" required className={`${cls} w-28`} />
      <input name="due_date" type="date" required className={cls} />
      <input name="remarks" placeholder="Item / note (required for Other/Repairs)" className={`${cls} min-w-[12rem] flex-1`} />
      <button type="submit" disabled={pending} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
        {pending ? "Saving…" : "Add due"}
      </button>
      {state && !state.ok && <p className="w-full text-sm text-red-700">{state.error}</p>}
    </form>
  );
}

export function MarkPaid({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function pay() {
    setBusy(true);
    const r = await markDuePaid(id);
    setBusy(false);
    if (!r.ok) return window.alert(r.error);
    router.refresh();
  }
  return <button type="button" onClick={pay} disabled={busy} className="text-xs font-medium text-emerald-700 hover:underline disabled:opacity-50">mark paid</button>;
}
