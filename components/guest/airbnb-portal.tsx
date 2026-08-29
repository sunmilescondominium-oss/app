"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  requestAirbnbExtension, requestAirbnbCheckout,
  placeGuestOrder, requestGuestCleaning, requestGuestMaintenance, cancelGuestCleaning,
  type GuestActionState,
} from "@/app/(public)/airbnb/[token]/actions";
import type { AirbnbGuest } from "@/lib/guest/airbnb";
import type { AirbnbExtra, AirbnbOrder, AirbnbRequest } from "@/lib/airbnb/queries";

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fmtDuration(sec: number): string {
  const s = Math.abs(sec);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s % 60}s`;
}

const CATEGORIES = ["Food", "Parking", "Amenity", "Laundry", "Other"];

function ExtrasMenu({ token, extras, onDone }: { token: string; extras: AirbnbExtra[]; onDone: () => void }) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, number>>({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = extras.filter((e) => e.category === cat);
    return acc;
  }, {} as Record<string, AirbnbExtra[]>);

  const orderItems = extras
    .filter((e) => (qty[e.id] ?? 0) > 0)
    .map((e) => ({ extraId: e.id, name: e.name, qty: qty[e.id], unitPrice: e.unitPrice }));

  const total = orderItems.reduce((s, i) => s + i.qty * i.unitPrice, 0);

  async function place() {
    setBusy(true);
    setMsg(null);
    const res = await placeGuestOrder(token, orderItems, notes);
    setBusy(false);
    if (res?.ok) {
      setMsg({ tone: "ok", text: res.message });
      setQty({});
      setNotes("");
      router.refresh();
    } else {
      setMsg({ tone: "err", text: res?.error ?? "Something went wrong." });
    }
  }

  return (
    <div className="mt-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-800">Order extras</p>
        <button onClick={onDone} className="text-xs text-stone-400 hover:text-stone-600">Close</button>
      </div>
      {CATEGORIES.filter((c) => grouped[c]?.length > 0).map((cat) => (
        <div key={cat} className="mb-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-400">{cat}</p>
          {grouped[cat].map((e) => (
            <div key={e.id} className="flex items-center justify-between border-b border-stone-100 py-1.5">
              <div>
                <span className="text-sm text-stone-800">{e.name}</span>
                {e.unitPrice > 0 && <span className="ml-2 text-xs text-stone-500">{peso(e.unitPrice)}</span>}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setQty((q) => ({ ...q, [e.id]: Math.max(0, (q[e.id] ?? 0) - 1) }))}
                  className="h-6 w-6 rounded-full border border-stone-300 text-sm leading-none hover:bg-stone-100">−</button>
                <span className="w-5 text-center text-sm tabular-nums">{qty[e.id] ?? 0}</span>
                <button onClick={() => setQty((q) => ({ ...q, [e.id]: (q[e.id] ?? 0) + 1 }))}
                  className="h-6 w-6 rounded-full border border-stone-300 text-sm leading-none hover:bg-stone-100">+</button>
              </div>
            </div>
          ))}
        </div>
      ))}
      {orderItems.length > 0 && (
        <div className="mt-2 space-y-2">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Total</span>
            <span>{peso(total)}</span>
          </div>
          <input value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Special instructions (optional)"
            className="w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200" />
          <button onClick={place} disabled={busy}
            className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
            {busy ? "Placing order…" : "Place order"}
          </button>
        </div>
      )}
      {msg && <p className={`mt-2 rounded-lg px-3 py-2 text-sm ${msg.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}

function MaintenanceForm({ token, onDone }: { token: string; onDone: () => void }) {
  const router = useRouter();
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function submit() {
    setBusy(true);
    setMsg(null);
    const res = await requestGuestMaintenance(token, desc);
    setBusy(false);
    if (res?.ok) {
      setMsg({ tone: "ok", text: res.message });
      setDesc("");
      router.refresh();
    } else {
      setMsg({ tone: "err", text: res?.error ?? "Something went wrong." });
    }
  }

  return (
    <div className="mt-2 rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-stone-700">Report a maintenance issue</p>
        <button onClick={onDone} className="text-xs text-stone-400 hover:text-stone-600">Cancel</button>
      </div>
      <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3}
        placeholder="Describe the issue (e.g. AC not cooling, leaking faucet)"
        className="w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200" />
      <button onClick={submit} disabled={busy || !desc.trim()}
        className="w-full rounded-lg bg-stone-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-stone-800 disabled:opacity-60">
        {busy ? "Submitting…" : "Submit report"}
      </button>
      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}
    </div>
  );
}

const ORDER_STATUS: Record<string, { label: string; color: string }> = {
  pending:   { label: "Pending",   color: "bg-amber-100 text-amber-800" },
  fulfilled: { label: "Delivered", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", color: "bg-stone-100 text-stone-500" },
};
const REQUEST_TYPE: Record<string, string> = {
  cleaning:    "Room cleaning",
  maintenance: "Maintenance",
};
const REQUEST_STATUS: Record<string, { label: string; color: string }> = {
  pending:   { label: "Pending",   color: "bg-amber-100 text-amber-800" },
  scheduled: { label: "Scheduled", color: "bg-blue-100 text-blue-800" },
  done:      { label: "Done",      color: "bg-green-100 text-green-800" },
  cancelled: { label: "Cancelled", color: "bg-stone-100 text-stone-500" },
};

function fmtShort(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function OrderHistory({ orders }: { orders: AirbnbOrder[] }) {
  const [open, setOpen] = useState(false);
  if (!orders.length) return null;
  return (
    <div className="mt-4 rounded-xl border border-stone-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50"
      >
        <span>Orders ({orders.length})</span>
        <span className="text-stone-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="divide-y divide-stone-100">
          {orders.map((o) => {
            const s = ORDER_STATUS[o.status] ?? { label: o.status, color: "bg-stone-100 text-stone-600" };
            return (
              <div key={o.id} className="px-4 py-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-xs text-stone-400">{fmtShort(o.createdAt)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.color}`}>{s.label}</span>
                </div>
                <ul className="space-y-0.5">
                  {o.items.map((i) => (
                    <li key={i.id} className="flex items-baseline justify-between text-xs text-stone-700">
                      <span>{i.qty}× {i.name}</span>
                      <span className="tabular-nums text-stone-500">{peso(i.subtotal)}</span>
                    </li>
                  ))}
                </ul>
                {o.notes && <p className="mt-1 text-[11px] text-stone-400">"{o.notes}"</p>}
                <div className="mt-1.5 flex justify-end text-xs font-semibold">
                  <span>Total: {peso(o.total)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RequestHistory({ requests }: { requests: AirbnbRequest[] }) {
  const [open, setOpen] = useState(false);
  if (!requests.length) return null;
  return (
    <div className="mt-2 rounded-xl border border-stone-200 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-50"
      >
        <span>Requests ({requests.length})</span>
        <span className="text-stone-400">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="divide-y divide-stone-100">
          {requests.map((r) => {
            const s = REQUEST_STATUS[r.status] ?? { label: r.status, color: "bg-stone-100 text-stone-600" };
            return (
              <div key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-stone-700">{REQUEST_TYPE[r.requestType] ?? r.requestType}</p>
                  {r.notes && <p className="mt-0.5 text-[11px] text-stone-500 truncate">{r.notes}</p>}
                  <p className="mt-0.5 text-[10px] text-stone-400">{fmtShort(r.createdAt)}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${s.color}`}>{s.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AirbnbPortal({
  booking, extras = [], pendingCleaningId = null, orders = [], requests = [],
}: {
  booking: AirbnbGuest;
  extras?: AirbnbExtra[];
  pendingCleaningId?: string | null;
  orders?: AirbnbOrder[];
  requests?: AirbnbRequest[];
}) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [req, setReq] = useState("+1 day");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [showExtras, setShowExtras] = useState(false);
  const [showMaintenance, setShowMaintenance] = useState(false);
  const [cleaningBusy, setCleaningBusy] = useState(false);

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

  async function requestCleaning() {
    setCleaningBusy(true);
    setMsg(null);
    const res = await requestGuestCleaning(booking.token, "");
    setCleaningBusy(false);
    if (res?.ok) {
      setMsg({ tone: "ok", text: res.message });
      router.refresh();
    } else {
      setMsg({ tone: "err", text: res?.error ?? "Something went wrong." });
    }
  }

  async function cancelCleaning() {
    if (!pendingCleaningId) return;
    if (!window.confirm("Cancel your cleaning request?")) return;
    setCleaningBusy(true);
    setMsg(null);
    const res = await cancelGuestCleaning(booking.token, pendingCleaningId);
    setCleaningBusy(false);
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
        <div className={`rounded-xl p-4 text-center ${overtime ? "bg-rose-50" : "bg-stone-50"}`}>
          <p className="text-xs uppercase tracking-wide text-stone-500">{overtime ? "Checkout overdue by" : "Time remaining"}</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${overtime ? "text-rose-700" : "text-stone-900"}`}>{fmtDuration(remaining!)}</p>
          <p className="mt-1 text-xs text-stone-400">Checkout: {new Date(endMs).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
        </div>
      )}

      {booking.amenities.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Unit amenities</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {booking.amenities.map((a) => <span key={a} className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{a}</span>)}
          </div>
        </div>
      )}

      <table className="mt-4 w-full text-left text-sm">
        <tbody>
          <tr className="border-b border-stone-100"><td className="py-1.5">Booking rate (paid in advance)</td><td className="py-1.5 text-right tabular-nums">{peso(booking.rate)}</td></tr>
          {booking.extraCharges.map((c, i) => (
            <tr key={i} className="border-b border-stone-100"><td className="py-1.5 capitalize text-stone-600">{c.label}</td><td className="py-1.5 text-right tabular-nums">{peso(c.amount)}</td></tr>
          ))}
          <tr className="text-base font-bold"><td className="py-2">Balance due</td><td className="py-2 text-right tabular-nums text-rose-700">{peso(booking.balance)}</td></tr>
        </tbody>
      </table>

      {active ? (
        <div className="mt-5 space-y-3">
          {/* Extension request */}
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-stone-600">Request to extend</label>
              <input value={req} onChange={(e) => setReq(e.target.value)} placeholder="e.g. +1 day / until 2pm" className="w-full rounded-lg border border-stone-300 px-2.5 py-2 text-sm" />
            </div>
            <button type="button" onClick={() => run(() => requestAirbnbExtension(booking.token, req))} disabled={busy} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
              Request
            </button>
          </div>
          {booking.extensionRequested && <p className="text-xs text-amber-700">Extension requested ("{booking.extensionRequested}") — awaiting host.</p>}

          {/* Guest services */}
          {extras.length > 0 && !showExtras && (
            <button type="button" onClick={() => setShowExtras(true)}
              className="w-full rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-800 hover:bg-amber-100">
              Order food / extras
            </button>
          )}
          {showExtras && (
            <ExtrasMenu token={booking.token} extras={extras} onDone={() => setShowExtras(false)} />
          )}

          {/* Cleaning */}
          {pendingCleaningId ? (
            <button type="button" onClick={cancelCleaning} disabled={cleaningBusy}
              className="w-full rounded-lg border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-100 disabled:opacity-60">
              {cleaningBusy ? "…" : "Cancel cleaning request ✓"}
            </button>
          ) : (
            <button type="button" onClick={requestCleaning} disabled={cleaningBusy}
              className="w-full rounded-lg border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm font-semibold text-stone-700 hover:bg-stone-100 disabled:opacity-60">
              {cleaningBusy ? "Requesting…" : "Request room cleaning"}
            </button>
          )}

          {/* Maintenance */}
          {!showMaintenance && (
            <button type="button" onClick={() => setShowMaintenance(true)}
              className="w-full rounded-lg border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm text-stone-600 hover:bg-stone-100">
              Report maintenance issue
            </button>
          )}
          {showMaintenance && (
            <MaintenanceForm token={booking.token} onDone={() => setShowMaintenance(false)} />
          )}

          {/* Checkout */}
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
        <p className="mt-5 rounded-lg bg-stone-50 px-3 py-2 text-center text-sm text-stone-500">This booking has ended.</p>
      )}

      {msg && <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${msg.tone === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{msg.text}</p>}

      {(orders.length > 0 || requests.length > 0) && (
        <div className="mt-5 border-t border-stone-100 pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Your activity</p>
          <OrderHistory orders={orders} />
          <RequestHistory requests={requests} />
        </div>
      )}
    </div>
  );
}
