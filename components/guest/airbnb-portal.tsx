"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { requestAirbnbExtension, requestAirbnbCheckout, type GuestActionState } from "@/app/(public)/airbnb/[token]/actions";
import type { AirbnbGuest } from "@/lib/guest/airbnb";

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fmtDuration(sec: number): string {
  const s = Math.abs(sec);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s % 60}s`;
}

export function AirbnbPortal({ booking }: { booking: AirbnbGuest }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [req, setReq] = useState("+1 day");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const endMs = booking.endAt ? new Date(booking.endAt).getTime() : null;
  const remaining = endMs ? Math.round((endMs - now) / 1000) : null;
  const overtime = remaining != null && remaining < 0;
  const active = booking.status === "active";

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
      {endMs && (
        <div className={`rounded-xl p-4 text-center ${overtime ? "bg-rose-50" : "bg-slate-50"}`}>
          <p className="text-xs uppercase tracking-wide text-slate-500">{overtime ? "Checkout overdue by" : "Time remaining"}</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${overtime ? "text-rose-700" : "text-slate-900"}`}>{fmtDuration(remaining!)}</p>
          <p className="mt-1 text-xs text-slate-400">Checkout: {new Date(endMs).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
        </div>
      )}

      {booking.amenities.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Unit amenities</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {booking.amenities.map((a) => <span key={a} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{a}</span>)}
          </div>
        </div>
      )}

      <table className="mt-4 w-full text-left text-sm">
        <tbody>
          <tr className="border-b border-slate-100"><td className="py-1.5">Booking rate (paid in advance)</td><td className="py-1.5 text-right tabular-nums">{peso(booking.rate)}</td></tr>
          {booking.extraCharges.map((c, i) => (
            <tr key={i} className="border-b border-slate-100"><td className="py-1.5 capitalize text-slate-600">{c.label}</td><td className="py-1.5 text-right tabular-nums">{peso(c.amount)}</td></tr>
          ))}
          <tr className="text-base font-bold"><td className="py-2">Balance due</td><td className="py-2 text-right tabular-nums text-rose-700">{peso(booking.balance)}</td></tr>
        </tbody>
      </table>

      {active ? (
        <div className="mt-5 space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-slate-600">Request to extend</label>
              <input value={req} onChange={(e) => setReq(e.target.value)} placeholder="e.g. +1 day / until 2pm" className="w-full rounded-lg border border-slate-300 px-2.5 py-2 text-sm" />
            </div>
            <button type="button" onClick={() => run(() => requestAirbnbExtension(booking.token, req))} disabled={busy} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
              Request
            </button>
          </div>
          {booking.extensionRequested && <p className="text-xs text-amber-700">Extension requested (“{booking.extensionRequested}”) — awaiting host.</p>}

          <button
            type="button"
            onClick={() => { if (window.confirm("Request check-out?")) run(() => requestAirbnbCheckout(booking.token)); }}
            disabled={busy || booking.checkoutRequested}
            className="w-full rounded-lg bg-rose-600 px-4 py-2.5 font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {booking.checkoutRequested ? "Check-out requested ✓" : "Check out"}
          </button>
        </div>
      ) : (
        <p className="mt-5 rounded-lg bg-slate-50 px-3 py-2 text-center text-sm text-slate-500">This booking has ended.</p>
      )}

      {msg && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}
