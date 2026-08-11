"use client";

import { useActionState, useTransition, useState } from "react";
import { createReservation, submitLoadRequest } from "@/app/gift-card/[token]/actions";
import type { PortalResult } from "@/app/gift-card/[token]/actions";
import type { GiftCardDetail } from "@/lib/gift-cards/types";

interface Props {
  card: GiftCardDetail;
  token: string;
}

const TX_COLORS: Record<string, string> = {
  sale: "text-green-700",
  load: "text-green-700",
  checkin: "text-rose-600",
  extension: "text-rose-600",
  no_show: "text-rose-600",
  void: "text-stone-400",
  adjustment: "text-amber-700",
};

function fmtDt(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function BalanceBar({ balance, total }: { balance: number; total: number }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (balance / total) * 100)) : 0;
  return (
    <div className="h-3 w-full rounded-full bg-stone-200 overflow-hidden">
      <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function ReserveForm({ token, max, balance }: { token: string; max: number; balance: number }) {
  const boundAction = createReservation.bind(null, token);
  const [state, formAction] = useActionState<PortalResult | undefined, FormData>(boundAction, undefined);
  const [pending, startTransition] = useTransition();

  return (
    <form action={(fd) => startTransition(() => formAction(fd))} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Date &amp; time *</label>
          <input
            name="scheduled_at"
            type="datetime-local"
            required
            min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">
            Hours planned * (max {Math.min(max, balance)})
          </label>
          <input
            name="planned_hours"
            type="number"
            min={1}
            max={Math.min(max, balance)}
            defaultValue={Math.min(3, max, balance)}
            required
            className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Notes (optional)</label>
        <input name="notes" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="Room preference, etc." />
      </div>
      {state && !state.ok && (
        <p className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
          Reservation submitted! Please arrive within the buffer window. The cashier will activate your room timer on arrival.
        </p>
      )}
      <button
        type="submit"
        disabled={pending || balance <= 0}
        className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {pending ? "Scheduling…" : "Schedule visit"}
      </button>
    </form>
  );
}

function LoadForm({ token }: { token: string }) {
  const boundAction = submitLoadRequest.bind(null, token);
  const [state, formAction] = useActionState<PortalResult | undefined, FormData>(boundAction, undefined);
  const [pending, startTransition] = useTransition();

  return (
    <form action={(fd) => startTransition(() => formAction(fd))} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Amount paid (₱) *</label>
          <input name="amount_paid" type="number" min={0} step={0.01} required className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="3000" />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Hours requested *</label>
          <input name="hours_requested" type="number" min={1} step={0.5} required className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="30" />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Payment method *</label>
          <select name="payment_method" required className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm">
            <option value="">Select…</option>
            <option value="GCash">GCash</option>
            <option value="Maya">Maya</option>
            <option value="Bank transfer">Bank transfer</option>
            <option value="Cash">Cash</option>
            <option value="Other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-600 mb-1">Reference / confirmation no.</label>
          <input name="reference_no" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="GCash ref, etc." />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-stone-600 mb-1">Notes (optional)</label>
        <input name="notes" className="w-full rounded-lg border border-stone-200 px-3 py-2 text-sm" placeholder="Anything else" />
      </div>
      {state && !state.ok && (
        <p className="rounded-lg bg-rose-50 border border-rose-200 px-3 py-2 text-sm text-rose-700">{state.error}</p>
      )}
      {state?.ok && (
        <p className="rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-700">
          Load request submitted! Your hours will be credited once our team verifies your payment.
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
      >
        {pending ? "Submitting…" : "Submit reload request"}
      </button>
    </form>
  );
}

type Tab = "balance" | "reserve" | "reload" | "history";

export function GiftCardPortal({ card, token }: Props) {
  const [tab, setTab] = useState<Tab>("balance");
  const tabs: { id: Tab; label: string }[] = [
    { id: "balance", label: "Balance" },
    { id: "reserve", label: "Schedule visit" },
    ...(card.is_loadable ? [{ id: "reload" as Tab, label: "Reload" }] : []),
    { id: "history", label: "History" },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        <p className="text-xs text-stone-400 mb-1">Gift Card</p>
        <p className="font-mono text-xl font-bold text-stone-800">{card.card_code}</p>
        <p className="text-sm text-stone-500 mb-4">{card.owner_label}</p>
        <BalanceBar balance={card.balance_hours} total={card.total_hours} />
        <div className="mt-2 flex items-baseline gap-1">
          <span className="text-3xl font-bold text-amber-700">{card.balance_hours}</span>
          <span className="text-sm text-stone-400">/ {card.total_hours} hrs remaining</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl border border-stone-200 bg-stone-100 p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
              tab === t.id
                ? "bg-white text-stone-900 shadow-sm"
                : "text-stone-500 hover:text-stone-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5">
        {tab === "balance" && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-stone-50 p-3">
                <p className="text-xs text-stone-400">Max per stay</p>
                <p className="font-semibold text-stone-800">{card.max_hours_per_stay}h</p>
              </div>
              <div className="rounded-lg bg-stone-50 p-3">
                <p className="text-xs text-stone-400">Max extension</p>
                <p className="font-semibold text-stone-800">{card.max_extension_hours}h</p>
              </div>
              <div className="rounded-lg bg-stone-50 p-3">
                <p className="text-xs text-stone-400">No-show buffer</p>
                <p className="font-semibold text-stone-800">{card.buffer_minutes} min</p>
              </div>
              {card.expires_at && (
                <div className="rounded-lg bg-stone-50 p-3">
                  <p className="text-xs text-stone-400">Expires</p>
                  <p className="font-semibold text-stone-800">{new Date(card.expires_at).toLocaleDateString("en-PH")}</p>
                </div>
              )}
            </div>
            <p className="text-xs text-stone-400 pt-2">
              Note: hours are consumed per check-in. You cannot use the full balance in one stay (max {card.max_hours_per_stay}h/stay).
              Extensions of 1–{card.max_extension_hours}h may be deducted during a stay.
              A no-show deducts 1 hour from your balance.
            </p>
          </div>
        )}
        {tab === "reserve" && (
          <ReserveForm token={token} max={card.max_hours_per_stay} balance={card.balance_hours} />
        )}
        {tab === "reload" && (
          <div className="space-y-3">
            <p className="text-xs text-stone-500">
              Submit your payment details below. Our team will verify and credit your hours within 24 hours.
            </p>
            <LoadForm token={token} />
          </div>
        )}
        {tab === "history" && (
          <div className="space-y-2">
            {card.transactions.length === 0 ? (
              <p className="text-sm text-stone-400">No transactions yet.</p>
            ) : (
              card.transactions.map((t) => (
                <div key={t.id} className="flex items-center justify-between border-b border-stone-100 pb-2 last:border-0">
                  <div>
                    <p className={`text-sm font-medium ${TX_COLORS[t.type] ?? "text-stone-700"}`}>
                      {t.hours > 0 ? "+" : ""}{t.hours}h
                      <span className="ml-1 text-xs font-normal text-stone-400">({t.type})</span>
                    </p>
                    {t.notes && <p className="text-xs text-stone-400">{t.notes}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-stone-800">{t.balance_after}h</p>
                    <p className="text-xs text-stone-400">{fmtDt(t.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Reservations (pending) */}
      {card.reservations.filter((r) => r.status === "pending").length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <p className="text-xs font-semibold text-amber-700 uppercase mb-2">Upcoming reservations</p>
          {card.reservations.filter((r) => r.status === "pending").map((r) => (
            <div key={r.id} className="text-sm text-stone-700 mb-1">
              {fmtDt(r.scheduled_at)} · {r.planned_hours}h
              {r.unit_number ? ` · Room ${r.unit_number}` : ""}
              <span className="text-xs text-amber-600 ml-2">({card.buffer_minutes}m grace window)</span>
            </div>
          ))}
        </div>
      )}

      <p className="text-center text-xs text-stone-400 pb-4">
        <a href="/gift-card" className="hover:underline">Sign out</a>
      </p>
    </div>
  );
}
