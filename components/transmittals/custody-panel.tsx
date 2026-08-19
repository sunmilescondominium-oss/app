"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordCustodyStep, type ActionResult } from "@/app/(app)/transmittals/actions";
import { CUSTODY_ORDER, CUSTODY_STAGES, nextStage, type CustodyStage } from "@/lib/collections/custody";
import type { CustodyEvent } from "@/lib/collections/queries";
import { peso } from "@/lib/collections/summary";

const cls = "rounded-lg border border-stone-300 px-2.5 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

function roleLabel(rk: string | null): string {
  if (!rk) return "—";
  return rk.charAt(0).toUpperCase() + rk.slice(1).replace(/_/g, " ");
}

export interface BankOption { id: string; label: string }

// Confirm panel shown before final submit. Highlights discrepancies.
function ConfirmPanel({
  label,
  expected,
  entered,
  hasAmount,
  onEdit,
  onConfirm,
  pending,
  error,
}: {
  label: string;
  expected: number;
  entered: number;
  hasAmount: boolean;
  onEdit: () => void;
  onConfirm: () => void;
  pending: boolean;
  error: string;
}) {
  const variance = hasAmount ? Math.round((entered - expected) * 100) / 100 : 0;
  const hasDiscrepancy = hasAmount && variance !== 0;

  return (
    <div className="mt-5 rounded-xl border border-stone-300 bg-white p-4 space-y-3">
      <p className="text-sm font-semibold text-stone-800">Confirm: {label}</p>

      {hasAmount && (
        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-500">Expected (system total)</span>
            <span className="tabular-nums font-medium">{peso(expected)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">You entered</span>
            <span className="tabular-nums font-medium">{peso(entered)}</span>
          </div>
          <div className={`flex justify-between border-t pt-1.5 font-semibold ${hasDiscrepancy ? (variance < 0 ? "text-rose-700" : "text-amber-700") : "text-emerald-700"}`}>
            <span>{hasDiscrepancy ? (variance < 0 ? "⚠ Shortage" : "⚠ Overage") : "✓ Exact match"}</span>
            <span className="tabular-nums">{hasDiscrepancy ? peso(Math.abs(variance)) : peso(0)}</span>
          </div>
        </div>
      )}

      {hasDiscrepancy && (
        <div className={`rounded-lg border px-3 py-2 text-xs ${variance < 0 ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
          {variance < 0
            ? `There is a shortage of ${peso(Math.abs(variance))}. Please double-check your count before proceeding. The discrepancy will be recorded on this transmittal.`
            : `You are reporting ${peso(variance)} more than the system total. Please verify before proceeding. The overage will be recorded on this transmittal.`}
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          disabled={pending}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-60"
        >
          ← Edit
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={pending}
          className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${hasDiscrepancy ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700"}`}
        >
          {pending ? "Submitting…" : hasDiscrepancy ? "Submit with discrepancy" : "Confirm & Submit"}
        </button>
      </div>
    </div>
  );
}

export function CustodyPanel({
  transmittalId, currentStage, total, events, canActNext, bankAccounts,
}: {
  transmittalId: string;
  currentStage: CustodyStage;
  total: number;
  events: CustodyEvent[];
  canActNext: boolean;
  bankAccounts: BankOption[];
}) {
  const router = useRouter();
  const [state, setState] = useState<ActionResult | undefined>(undefined);
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [enteredAmount, setEnteredAmount] = useState(0);
  const pendingFd = useRef<FormData | null>(null);

  const next = nextStage(currentStage);
  const def = next ? CUSTODY_STAGES[next] : null;
  const byStage = new Map(events.map((e) => [e.stage, e]));
  const doneIdx = CUSTODY_ORDER.indexOf(currentStage);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    pendingFd.current = fd;
    if (def?.needs.counted) {
      setEnteredAmount(Number(fd.get("counted_amount") ?? 0));
    }
    setConfirming(true);
  }

  function doSubmit() {
    if (!pendingFd.current) return;
    const fd = pendingFd.current;
    startTransition(async () => {
      const res = await recordCustodyStep(transmittalId, undefined, fd);
      setState(res);
      if (res?.ok) router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-stone-500">Chain of custody</h2>

      {/* Timeline */}
      <ol className="mt-4 space-y-3">
        {CUSTODY_ORDER.map((stage, i) => {
          const s = CUSTODY_STAGES[stage];
          const ev = byStage.get(stage);
          const done = i <= doneIdx;
          const isNext = stage === next;
          return (
            <li key={stage} className="flex gap-3">
              <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-emerald-600 text-white" : isNext ? "bg-amber-500 text-white" : "bg-stone-200 text-stone-500"}`}>
                {done ? "✓" : i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${done ? "text-stone-900" : "text-stone-500"}`}>{s.label}</p>
                <p className="text-xs text-stone-400">{s.blurb}</p>
                {ev && (
                  <p className="mt-0.5 text-xs text-stone-600">
                    {roleLabel(ev.actor_role)} · {new Date(ev.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {ev.counted_amount != null && <> · counted <span className="tabular-nums">{peso(ev.counted_amount)}</span></>}
                    {ev.variance != null && ev.variance !== 0 && <span className={ev.variance < 0 ? "text-rose-600" : "text-amber-600"}> (var {peso(ev.variance)})</span>}
                    {ev.passbook_ref && <> · passbook {ev.passbook_ref}</>}
                    {ev.deposit_slip_ref && <> · slip {ev.deposit_slip_ref}</>}
                    {ev.bank_account_label && <> · {ev.bank_account_label}</>}
                    {ev.note && <span className="block text-stone-400">{ev.note}</span>}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      {/* Next-step form or confirm panel */}
      {def && (
        canActNext ? (
          confirming ? (
            <ConfirmPanel
              label={def.label}
              expected={total}
              entered={enteredAmount}
              hasAmount={!!def.needs.counted}
              onEdit={() => setConfirming(false)}
              onConfirm={doSubmit}
              pending={pending}
              error={state && !state.ok ? state.error : ""}
            />
          ) : (
            <form onSubmit={handleSubmit} className="mt-5 grid gap-2 rounded-xl border border-amber-200 bg-amber-50/50 p-4 sm:grid-cols-2">
              <p className="text-xs font-semibold text-amber-800 sm:col-span-2">Next: {def.label}</p>
              {def.needs.counted && (
                <label className="text-xs font-medium text-stone-500">Amount counted (expected {peso(total)})
                  <input name="counted_amount" type="number" step="0.01" min="0" required className={`${cls} mt-1 w-full`} />
                </label>
              )}
              {def.needs.passbook && (
                <label className="text-xs font-medium text-stone-500">Passbook ref<input name="passbook_ref" required className={`${cls} mt-1 w-full`} /></label>
              )}
              {def.needs.depositSlip && (
                <label className="text-xs font-medium text-stone-500">Deposit slip ref<input name="deposit_slip_ref" required className={`${cls} mt-1 w-full`} /></label>
              )}
              {def.needs.bankAccount && (
                <label className="text-xs font-medium text-stone-500">Bank account
                  <select name="bank_account_id" required defaultValue="" className={`${cls} mt-1 w-full`}>
                    <option value="" disabled>Choose…</option>
                    {bankAccounts.map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                  </select>
                </label>
              )}
              <label className="text-xs font-medium text-stone-500 sm:col-span-2">Note<input name="note" className={`${cls} mt-1 w-full`} /></label>
              <div className="flex items-center gap-2 sm:col-span-2">
                <button type="submit" className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700">{def.cta}</button>
                {state && !state.ok && <p className="text-sm text-red-700">{state.error}</p>}
              </div>
            </form>
          )
        ) : (
          <p className="mt-4 rounded-lg bg-stone-50 px-3 py-2 text-xs text-stone-500">
            Waiting for <span className="font-medium">{def.actorRoles.map(roleLabel).join(" / ")}</span> to record: {def.label}.
          </p>
        )
      )}
      {!def && <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700">Custody chain complete — deposited.</p>}
    </div>
  );
}
