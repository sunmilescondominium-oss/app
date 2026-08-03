"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { issueStock, receiveStock, physicalCount, type ActionResult } from "@/app/(app)/housekeeping/actions";
import type { RoomSupply, StockMovement } from "@/lib/housekeeping/types";

const cls = "rounded-lg border border-slate-300 px-2.5 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

const REASON_LABEL: Record<string, string> = {
  issue: "Issued", receive: "Received", adjust: "Adjusted", count: "Physical count", replacement: "Room replacement",
};

function MovementForm({ label, supplies, qtyName, action, canManage }: { label: string; supplies: RoomSupply[]; qtyName: string; action: (p: ActionResult | undefined, fd: FormData) => Promise<ActionResult>; canManage: boolean }) {
  const router = useRouter();
  const [state, act, pending] = useActionState<ActionResult | undefined, FormData>(action, undefined);
  useEffect(() => { if (state?.ok) router.refresh(); }, [state, router]);
  if (!canManage && qtyName !== "qty") return null;
  return (
    <form action={act} className="flex flex-wrap items-end gap-2">
      <select name="supply_id" required className={cls} defaultValue="">
        <option value="" disabled>Supply…</option>
        {supplies.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.stock_qty} {s.unit_label})</option>)}
      </select>
      <input name={qtyName} type="number" step="0.01" min="0" placeholder={qtyName === "counted" ? "Counted qty" : "Qty"} required className={`${cls} w-28`} />
      <input name="note" placeholder="Note / for…" className={`${cls} min-w-[8rem] flex-1`} />
      <button type="submit" disabled={pending} className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
        {pending ? "…" : label}
      </button>
      {state && !state.ok && <p className="w-full text-sm text-red-700">{state.error}</p>}
    </form>
  );
}

export function StockMovementsPanel({ supplies, movements, canManage }: { supplies: RoomSupply[]; movements: StockMovement[]; canManage: boolean }) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Dispensing & stock movements</h2>

      <div className="mb-3 space-y-2 rounded-2xl border border-slate-200 bg-white p-4">
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">Dispense / issue (any staff)</p>
          <MovementForm label="Issue" supplies={supplies} qtyName="qty" action={issueStock} canManage />
        </div>
        {canManage && (
          <>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Receive delivery</p>
              <MovementForm label="Receive" supplies={supplies} qtyName="qty" action={receiveStock} canManage />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Physical count (periodical)</p>
              <MovementForm label="Record count" supplies={supplies} qtyName="counted" action={physicalCount} canManage />
            </div>
          </>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Supply</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3 text-right">Change</th>
              <th className="px-4 py-3 text-right">Balance</th>
              <th className="px-4 py-3">By</th>
              <th className="px-4 py-3">Note</th>
            </tr>
          </thead>
          <tbody>
            {movements.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">No movements yet.</td></tr>}
            {movements.map((m) => (
              <tr key={m.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-2.5 text-slate-500">{new Date(m.createdAt).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                <td className="px-4 py-2.5 font-medium text-slate-800">{m.supplyName}</td>
                <td className="px-4 py-2.5">{REASON_LABEL[m.reason] ?? m.reason}</td>
                <td className={`px-4 py-2.5 text-right tabular-nums ${m.delta < 0 ? "text-rose-700" : "text-emerald-700"}`}>{m.delta >= 0 ? "+" : ""}{m.delta}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{m.balanceAfter}</td>
                <td className="px-4 py-2.5 capitalize">{m.actor}</td>
                <td className="px-4 py-2.5 text-slate-500">{m.note ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
