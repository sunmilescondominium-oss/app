"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  requestKioskFallback, approveKioskFallback, rejectKioskFallback, closeKioskFallback,
} from "@/app/(app)/kiosk-access/actions";
import type { Outage } from "@/lib/kiosk/fallback";

const STATUS_CLS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  active: "bg-emerald-100 text-emerald-800",
  closed: "bg-stone-200 text-stone-600",
  expired: "bg-stone-200 text-stone-500",
  rejected: "bg-rose-100 text-rose-700",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function FallbackConsole({ outages, canApprove, mobileUrl }: { outages: Outage[]; canApprove: boolean; mobileUrl: string }) {
  const router = useRouter();
  const [ids, setIds] = useState("");
  const [kind, setKind] = useState<"in" | "out">("in");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submitRequest() {
    setErr(null);
    const list = ids.split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
    if (list.length === 0) { setErr("Enter at least one employee ID."); return; }
    if (!reason.trim()) { setErr("A reason/note is required — no code is generated without it."); return; }
    setBusy(true);
    const res = await requestKioskFallback({ employeeNos: list, punchKind: kind, reason });
    setBusy(false);
    if (!res.ok) { setErr(res.error); return; }
    setIds(""); setReason("");
    router.refresh();
  }

  async function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.ok) { window.alert(res.error); return; }
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Report kiosk down */}
      <div className="rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="mb-1 font-semibold text-stone-800">Report kiosk down → request mobile access</h2>
        <p className="mb-3 text-sm text-stone-500">Enter the ID numbers of employees who need to clock {kind === "in" ? "in" : "out"} from their phones. An authorizer must approve before the code works.</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block text-stone-600">Employee IDs (one per line or comma-separated)</span>
            <textarea value={ids} onChange={(e) => setIds(e.target.value)} rows={3} placeholder="1001&#10;1002&#10;1003" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-stone-600">This is for</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as "in" | "out")} className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm">
              <option value="in">Clock In (arrival)</option>
              <option value="out">Clock Out (departure)</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-stone-600">Reason / note</span>
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. kiosk tablet not turning on" className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm" />
          </label>
        </div>
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        <button type="button" onClick={submitRequest} disabled={busy} className="mt-3 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50">
          {busy ? "Submitting…" : "Submit request"}
        </button>
      </div>

      {/* Instances */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Recent kiosk-down instances</h2>
        {outages.length === 0 && <p className="text-sm text-stone-500">No requests yet.</p>}
        {outages.map((o) => (
          <div key={o.id} className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_CLS[o.status] ?? "bg-stone-100"}`}>{o.status}</span>
                <span className="text-xs text-stone-500">Clock {o.punchKind === "in" ? "In" : "Out"} · requested by {o.requestedByLabel ?? "—"} · {fmt(o.createdAt)}</span>
              </div>
              <span className="text-xs text-stone-500">{o.doneCount}/{o.grants.length} done</span>
            </div>

            {o.status === "active" && o.code && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-300 bg-emerald-50 p-3">
                <div>
                  <p className="text-xs font-medium text-emerald-700">Temporary code — give to the authorized employees</p>
                  <p className="font-mono text-2xl font-bold tracking-widest text-emerald-900">{o.code}</p>
                </div>
                <div className="text-xs text-emerald-800">
                  <p>Expires {fmt(o.expiresAt)}</p>
                  <p className="mt-0.5">Open on phone: <span className="font-medium">{mobileUrl}</span></p>
                </div>
              </div>
            )}

            {o.reason && <p className="mt-2 text-xs text-stone-500">Note: {o.reason}</p>}
            {o.rejectReason && <p className="mt-2 text-xs text-rose-600">Rejected: {o.rejectReason}</p>}

            <div className="mt-3 flex flex-wrap gap-1.5">
              {o.grants.map((g) => (
                <span key={g.userId} className={`rounded-full px-2 py-0.5 text-[11px] ${g.used ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                  {g.label}{g.used ? " ✓" : ""}
                </span>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {o.status === "pending" && canApprove && (
                <>
                  <button type="button" onClick={() => act(() => approveKioskFallback(o.id))} disabled={busy} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Approve & issue code</button>
                  <button type="button" onClick={() => { const r = window.prompt("Reason for rejecting?") ?? ""; act(() => rejectKioskFallback(o.id, r)); }} disabled={busy} className="rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50">Reject</button>
                </>
              )}
              {o.status === "pending" && !canApprove && <span className="text-xs text-stone-400">Waiting for an authorizer to approve.</span>}
              {(o.status === "active" || o.status === "pending") && (
                <button type="button" onClick={() => act(() => closeKioskFallback(o.id))} disabled={busy} className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-50">
                  Kiosk is back — deactivate
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
