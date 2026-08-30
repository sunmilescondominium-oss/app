"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { fulfillAirbnbOrder, cancelAirbnbOrder, updateAirbnbRequest } from "@/app/(app)/rentals/actions";
import type { AirbnbOrder, AirbnbRequest } from "@/lib/airbnb/queries";

const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fmtShort(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

const ORDER_CHIP: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-800",
  fulfilled: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-stone-100 text-stone-500",
};
const REQUEST_CHIP: Record<string, string> = {
  pending:   "bg-amber-100 text-amber-800",
  scheduled: "bg-blue-100 text-blue-800",
  done:      "bg-emerald-100 text-emerald-700",
  cancelled: "bg-stone-100 text-stone-500",
};
const REQUEST_LABEL: Record<string, string> = {
  cleaning: "Room cleaning", maintenance: "Maintenance",
};

function OrderCard({ order }: { order: AirbnbOrder }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    start(async () => {
      const r = await fn();
      if (!r.ok) alert(r.error ?? "Error");
      else router.refresh();
    });
  }

  const chip = ORDER_CHIP[order.status] ?? "bg-stone-100 text-stone-600";

  return (
    <div className="rounded-lg border border-stone-100 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-stone-400">{fmtShort(order.createdAt)}</span>
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${chip}`}>
          {order.status === "fulfilled" ? "Fulfilled" : order.status.charAt(0).toUpperCase() + order.status.slice(1)}
        </span>
      </div>
      <ul className="mb-1.5 space-y-0.5">
        {order.items.map((i) => (
          <li key={i.id} className="flex items-baseline justify-between text-xs text-stone-700">
            <span>{i.qty}× {i.name}</span>
            <span className="tabular-nums text-stone-500">{peso(i.subtotal)}</span>
          </li>
        ))}
      </ul>
      {order.notes && <p className="mb-1.5 text-[11px] text-stone-400">"{order.notes}"</p>}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-stone-800">Total: {peso(order.total)}</span>
        {order.status === "pending" && (
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={pending}
              onClick={() => act(() => fulfillAirbnbOrder(order.id))}
              className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {pending ? "…" : "Mark fulfilled"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => { if (confirm("Cancel this order?")) act(() => cancelAirbnbOrder(order.id)); }}
              className="rounded-md border border-stone-300 px-2.5 py-1 text-[11px] text-stone-600 hover:bg-stone-50 disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RequestCard({ req }: { req: AirbnbRequest }) {
  const router = useRouter();
  const [pending, start] = useTransition();

  function act(status: "scheduled" | "done" | "cancelled") {
    start(async () => {
      const r = await updateAirbnbRequest(req.id, status);
      if (!r.ok) alert(r.error ?? "Error");
      else router.refresh();
    });
  }

  const chip = REQUEST_CHIP[req.status] ?? "bg-stone-100 text-stone-600";
  const terminal = req.status === "done" || req.status === "cancelled";

  return (
    <div className="rounded-lg border border-stone-100 p-3">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-stone-800">
            {REQUEST_LABEL[req.requestType] ?? req.requestType}
          </p>
          {req.notes && <p className="mt-0.5 text-xs text-stone-500">{req.notes}</p>}
          <p className="mt-0.5 text-[10px] text-stone-400">{fmtShort(req.createdAt)}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${chip}`}>
          {req.status}
        </span>
      </div>
      {!terminal && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {req.status === "pending" && (
            <button
              type="button"
              disabled={pending}
              onClick={() => act("scheduled")}
              className="rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {pending ? "…" : "Mark scheduled"}
            </button>
          )}
          {(req.status === "pending" || req.status === "scheduled") && (
            <button
              type="button"
              disabled={pending}
              onClick={() => act("done")}
              className="rounded-md bg-emerald-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {pending ? "…" : "Mark done"}
            </button>
          )}
          <button
            type="button"
            disabled={pending}
            onClick={() => { if (confirm("Cancel this request?")) act("cancelled"); }}
            className="rounded-md border border-stone-300 px-2.5 py-1 text-[11px] text-stone-600 hover:bg-stone-50 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

export function AirbnbOrdersPanel({
  orders, requests,
}: {
  orders: AirbnbOrder[];
  requests: AirbnbRequest[];
}) {
  if (!orders.length && !requests.length) return null;

  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-2">
      {orders.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-stone-800">Guest Orders ({orders.length})</p>
          <div className="space-y-3">
            {orders.map((o) => <OrderCard key={o.id} order={o} />)}
          </div>
        </div>
      )}
      {requests.length > 0 && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-stone-800">Guest Requests ({requests.length})</p>
          <div className="space-y-2">
            {requests.map((r) => <RequestCard key={r.id} req={r} />)}
          </div>
        </div>
      )}
    </div>
  );
}
