"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requestExtension, requestCheckout, type GuestActionState } from "@/app/(public)/guest/[token]/actions";
import type { GuestStay } from "@/lib/guest/queries";

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fmt(sec: number): string {
  const s = Math.abs(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

export function GuestPortal({ stay }: { stay: GuestStay }) {
  const router = useRouter();
  const outMs = new Date(stay.checkInAt).getTime() + stay.plannedHours * 3_600_000;
  const [now, setNow] = useState(() => Date.now());
  const [hours, setHours] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const remaining = Math.round((outMs - now) / 1000);
  const overtime = remaining < 0;
  const active = stay.status === "active";
  // The Extend option only appears within 15 minutes of checkout (or overtime).
  const canExtend = active && remaining <= 15 * 60;

  async function run(fn: () => Promise<GuestActionState>) {
    setBusy(true);
    setMsg(null);
    const res = await fn();
    setBusy(false);
    if (res?.ok) {
      setMsg({ tone: "ok", text: res.message });
      router.refresh();
    } else {
      setMsg({ tone: "err", text: res?.error ?? "Something went wrong." });
    }
  }

  return (
    <div>
      {/* Timer */}
      <div className={`rounded-xl p-4 text-center ${overtime ? "bg-rose-50" : "bg-stone-50"}`}>
        <p className="text-xs uppercase tracking-wide text-stone-500">{overtime ? "Time over by" : "Time remaining"}</p>
        <p className={`mt-1 text-3xl font-bold tabular-nums ${overtime ? "text-rose-700" : "text-stone-900"}`}>{fmt(remaining)}</p>
        <p className="mt-1 text-xs text-stone-400">Planned checkout: {new Date(outMs).toLocaleString("en-PH", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}</p>
        {overtime && <p className="mt-1 text-xs text-rose-600">Extra hours will be added to your bill at checkout.</p>}
      </div>

      {/* Bill */}
      <table className="mt-4 w-full text-left text-sm">
        <tbody>
          <tr className="border-b border-stone-100"><td className="py-1.5">Room charge (net of discount)</td><td className="py-1.5 text-right tabular-nums">{peso(stay.total - stay.ordersTotal)}</td></tr>
          {stay.orders.map((o, i) => (
            <tr key={i} className="border-b border-stone-100"><td className="py-1.5 text-stone-600">{o.name} ×{o.qty}</td><td className="py-1.5 text-right tabular-nums">{peso(o.amount)}</td></tr>
          ))}
          <tr className="border-b border-stone-100 font-semibold"><td className="py-2">Total</td><td className="py-2 text-right tabular-nums">{peso(stay.total)}</td></tr>
          <tr className="border-b border-stone-100"><td className="py-1.5">Paid</td><td className="py-1.5 text-right tabular-nums">{peso(stay.paid)}</td></tr>
          <tr className="text-base font-bold"><td className="py-2">Balance</td><td className="py-2 text-right tabular-nums text-rose-700">{peso(stay.balance)}</td></tr>
        </tbody>
      </table>
      {stay.balance > 0 && <p className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-center text-xs font-medium text-rose-700">Please settle {peso(stay.balance)} at the front desk before your gate pass is issued.</p>}

      {active ? (
        <div className="mt-5 space-y-3">
          {canExtend ? (
            <>
              <div className="flex items-end gap-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-stone-600">Request more time</label>
                  <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className="rounded-lg border border-stone-300 px-2.5 py-2 text-sm">
                    {[1, 2, 3, 4, 5, 6].map((h) => <option key={h} value={h}>+{h} hour{h > 1 ? "s" : ""}</option>)}
                  </select>
                </div>
                <button type="button" onClick={() => run(() => requestExtension(stay.token, hours))} disabled={busy} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
                  Extend — call cashier
                </button>
              </div>
              <p className="text-[11px] text-stone-400">Tapping Extend alerts the cashier, who will collect the extension payment.</p>
            </>
          ) : (
            <p className="rounded-lg bg-stone-50 px-3 py-2 text-center text-xs text-stone-500">The extension option appears 15 minutes before checkout.</p>
          )}
          {stay.extensionRequestedHours != null && <p className="text-xs text-amber-700">Extension requested (+{stay.extensionRequestedHours}h) — awaiting front desk.</p>}

          <button
            type="button"
            onClick={() => { if (window.confirm("Request check-out? The front desk will prepare your final bill.")) run(() => requestCheckout(stay.token)); }}
            disabled={busy || stay.checkoutRequested}
            className="w-full rounded-lg bg-rose-600 px-4 py-2.5 font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {stay.checkoutRequested ? "Check-out requested ✓" : "Check out"}
          </button>
          {stay.checkoutRequested && <p className="text-center text-xs text-stone-500">The front desk will finalize your bill and issue the gate pass after the room check.</p>}
        </div>
      ) : (
        <p className="mt-5 rounded-lg bg-stone-50 px-3 py-2 text-center text-sm text-stone-500">This stay is checked out.</p>
      )}

      {msg && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}
