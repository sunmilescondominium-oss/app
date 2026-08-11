"use client";

import { useTransition, useState } from "react";
import { deactivateGiftCard, cancelReservation, markNoShow, activateReservation, approveLoadRequest, rejectLoadRequest } from "@/app/(app)/hotel/gift-cards/actions";
import type { GiftCardDetail } from "@/lib/gift-cards/types";

interface Props {
  card: GiftCardDetail;
  canManageConfig: boolean;
  canWrite: boolean;
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
  return new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function BalanceBar({ balance, total }: { balance: number; total: number }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (balance / total) * 100)) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-stone-200 overflow-hidden">
      <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function GiftCardDetail({ card, canManageConfig, canWrite }: Props) {
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const [deactivateConfirm, setDeactivateConfirm] = useState(false);

  async function tryDeactivate() {
    setErr(null);
    const res = await deactivateGiftCard(card.id);
    if (!res.ok) setErr(res.error ?? "Error");
    setDeactivateConfirm(false);
  }

  return (
    <div className="space-y-6">
      {/* ── Card summary ── */}
      <div className="rounded-2xl border border-stone-200 bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-stone-500">Balance</p>
            <p className="text-3xl font-bold text-stone-800">{card.balance_hours}<span className="text-sm font-normal text-stone-400 ml-1">/ {card.total_hours} hrs</span></p>
          </div>
          <div className="text-right text-xs text-stone-400 space-y-0.5">
            <p>Max {card.max_hours_per_stay}h/stay</p>
            <p>Ext up to {card.max_extension_hours}h</p>
            <p>Buffer {card.buffer_minutes}m</p>
            {card.expires_at && <p>Expires {new Date(card.expires_at).toLocaleDateString("en-PH")}</p>}
          </div>
        </div>
        <BalanceBar balance={card.balance_hours} total={card.total_hours} />
        <div className="flex flex-wrap gap-3 text-xs text-stone-500">
          <span>Loadable: <strong>{card.is_loadable ? "Yes" : "No"}</strong></span>
          <span>Sold by: <strong>{card.sold_by_role ?? "—"}</strong></span>
          {card.notes && <span className="italic">{card.notes}</span>}
        </div>
        {err && <p className="text-sm text-rose-600">{err}</p>}
        {canManageConfig && card.is_active && (
          <div>
            {deactivateConfirm ? (
              <div className="flex gap-2 items-center">
                <span className="text-xs text-stone-500">Deactivate this card?</span>
                <button disabled={pending} onClick={() => startTransition(() => tryDeactivate())} className="rounded-lg bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700">Yes, deactivate</button>
                <button onClick={() => setDeactivateConfirm(false)} className="text-xs text-stone-400 hover:underline">Cancel</button>
              </div>
            ) : (
              <button onClick={() => setDeactivateConfirm(true)} className="text-xs text-rose-500 hover:underline">Deactivate card</button>
            )}
          </div>
        )}
      </div>

      {/* ── Reservations ── */}
      {card.reservations.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-stone-600 uppercase tracking-wide">Reservations</h2>
          <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
            {card.reservations.map((r) => (
              <div key={r.id} className="flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-stone-800">{fmtDt(r.scheduled_at)} · {r.planned_hours}h{r.unit_number ? ` · Room ${r.unit_number}` : ""}</p>
                  <p className="text-xs text-stone-400">{r.status.replace("_", "-")}{r.notes ? ` · ${r.notes}` : ""}</p>
                </div>
                {r.status === "pending" && canWrite && (
                  <div className="flex gap-2">
                    <button disabled={pending} onClick={() => startTransition(async () => { const res = await activateReservation(r.id); if (!res.ok) setErr(res.error ?? "Error"); })} className="rounded-lg bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60">Check in</button>
                    <button disabled={pending} onClick={() => startTransition(async () => { const res = await markNoShow(r.id); if (!res.ok) setErr(res.error ?? "Error"); })} className="rounded-lg border border-rose-200 px-3 py-1 text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-60">No-show</button>
                    <button disabled={pending} onClick={() => startTransition(async () => { const res = await cancelReservation(r.id); if (!res.ok) setErr(res.error ?? "Error"); })} className="rounded-lg border border-stone-200 px-3 py-1 text-xs text-stone-500 hover:bg-stone-50 disabled:opacity-60">Cancel</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Load requests ── */}
      {card.load_requests.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-semibold text-stone-600 uppercase tracking-wide">Load requests</h2>
          <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
            {card.load_requests.map((r) => (
              <div key={r.id} className="flex items-start justify-between px-5 py-3">
                <div>
                  <p className="text-sm font-medium text-stone-800">+{r.hours_requested}h · ₱{Number(r.amount_paid).toLocaleString("en-PH")} · {r.payment_method}</p>
                  <p className="text-xs text-stone-400">{r.status}{r.review_note ? ` — ${r.review_note}` : ""}</p>
                </div>
                <span className="text-xs text-stone-400">{fmtDt(r.created_at)}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Transaction ledger ── */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-stone-600 uppercase tracking-wide">Ledger</h2>
        {card.transactions.length === 0 ? (
          <p className="text-sm text-stone-400">No transactions yet.</p>
        ) : (
          <div className="divide-y divide-stone-100 rounded-2xl border border-stone-200 bg-white">
            {card.transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-5 py-2.5">
                <div>
                  <p className={`text-sm font-medium ${TX_COLORS[t.type] ?? "text-stone-700"}`}>
                    {t.hours > 0 ? "+" : ""}{t.hours}h <span className="text-stone-400 font-normal text-xs">({t.type})</span>
                  </p>
                  {t.notes && <p className="text-xs text-stone-400">{t.notes}</p>}
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-stone-800">{t.balance_after}h</p>
                  <p className="text-xs text-stone-400">{fmtDt(t.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
