"use client";

import { useState, useEffect, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  buildTransmittalForDate,
  fetchUntransmittedCollections,
  type CollectionOption,
} from "@/app/(app)/transmittals/actions";
import { DenominationCounter } from "./denomination-counter";
import { COLLECTION_CATEGORIES, PAYMENT_TYPES } from "@/lib/config";
import { peso } from "@/lib/collections/summary";

const CAT_LABEL = Object.fromEntries(COLLECTION_CATEGORIES.map((c) => [c.key, c.label]));
const PAY_LABEL = Object.fromEntries(PAYMENT_TYPES.map((p) => [p.key, p.label]));

const inputCls =
  "rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

export function BuildTransmittalForm({
  defaultDate,
  bankAccounts,
}: {
  defaultDate: string;
  bankAccounts: { id: string; label: string }[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [cols, setCols] = useState<CollectionOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [paymentMode, setPaymentMode] = useState<"cash" | "bank_transfer">("cash");
  const [loadState, setLoadState] = useState<"idle" | "loading" | "empty" | "done" | "error">("idle");
  const [loadErr, setLoadErr] = useState("");
  const [submitErr, setSubmitErr] = useState("");
  const [pending, startSubmit] = useTransition();
  const [denomTotal, setDenomTotal] = useState(0);

  // Confirm-step state
  const [confirming, setConfirming] = useState(false);
  const pendingFd = useRef<FormData | null>(null);

  async function load() {
    setLoadState("loading");
    setLoadErr("");
    setCols([]);
    setSelectedIds(new Set());
    const res = await fetchUntransmittedCollections();
    if (!res.ok) {
      setLoadState("error");
      setLoadErr(res.error);
      return;
    }
    setCols(res.collections);
    setSelectedIds(new Set(res.collections.map((c) => c.id)));
    setLoadState(res.collections.length === 0 ? "empty" : "done");
  }

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const grouped = cols.reduce<Record<string, CollectionOption[]>>((acc, c) => {
    (acc[c.collected_on] ??= []).push(c);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const allSelected = cols.length > 0 && cols.every((c) => selectedIds.has(c.id));
  const toggleId = (id: string) =>
    setSelectedIds((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleDate = (date: string) => {
    const ids = grouped[date].map((c) => c.id);
    const allChecked = ids.every((id) => selectedIds.has(id));
    setSelectedIds((s) => { const n = new Set(s); if (allChecked) ids.forEach((id) => n.delete(id)); else ids.forEach((id) => n.add(id)); return n; });
  };
  const selectedTotal = cols.filter((c) => selectedIds.has(c.id)).reduce((s, c) => s + c.amount, 0);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitErr("");
    const fd = new FormData(e.currentTarget);
    fd.set("collection_ids", JSON.stringify([...selectedIds]));
    pendingFd.current = fd;
    setConfirming(true);
  }

  function doSubmit() {
    if (!pendingFd.current) return;
    const fd = pendingFd.current;
    startSubmit(async () => {
      const res = await buildTransmittalForDate(undefined, fd);
      if (res.ok) {
        setConfirming(false);
        router.refresh();
        void load();
        formRef.current?.reset();
      } else {
        setSubmitErr(res.error);
        setConfirming(false);
      }
    });
  }

  // --- Confirm panel ---
  if (confirming) {
    const isCash = paymentMode === "cash";
    const variance = isCash ? Math.round((denomTotal - selectedTotal) * 100) / 100 : 0;
    const hasDiscrepancy = isCash && variance !== 0;

    return (
      <div className="no-print mb-6 space-y-4 rounded-2xl border border-stone-300 bg-white p-5">
        <p className="text-sm font-semibold text-stone-800">Confirm transmittal</p>

        <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-1.5 text-sm">
          <div className="flex justify-between">
            <span className="text-stone-500">Collections bundled</span>
            <span className="font-medium">{selectedIds.size} item(s)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-500">System total (selected)</span>
            <span className="tabular-nums font-medium">{peso(selectedTotal)}</span>
          </div>
          {isCash && (
            <>
              <div className="flex justify-between">
                <span className="text-stone-500">Denomination count</span>
                <span className="tabular-nums font-medium">{peso(denomTotal)}</span>
              </div>
              <div className={`flex justify-between border-t pt-1.5 font-semibold ${hasDiscrepancy ? (variance < 0 ? "text-rose-700" : "text-amber-700") : "text-emerald-700"}`}>
                <span>{hasDiscrepancy ? (variance < 0 ? "⚠ Shortage" : "⚠ Overage") : "✓ Exact match"}</span>
                <span className="tabular-nums">{hasDiscrepancy ? peso(Math.abs(variance)) : peso(0)}</span>
              </div>
            </>
          )}
          {!isCash && (
            <div className="flex justify-between text-stone-500">
              <span>Payment mode</span>
              <span>Bank transfer</span>
            </div>
          )}
        </div>

        {hasDiscrepancy && (
          <div className={`rounded-lg border px-3 py-2 text-xs ${variance < 0 ? "border-rose-200 bg-rose-50 text-rose-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>
            {variance < 0
              ? `Your denomination count is ${peso(Math.abs(variance))} less than the system total. Please recount the cash or edit the collections before submitting. The discrepancy will be recorded on this transmittal.`
              : `Your denomination count is ${peso(variance)} more than the system total. Please verify before proceeding.`}
          </div>
        )}

        {submitErr && <p className="text-sm text-red-700">{submitErr}</p>}

        <div className="flex gap-2">
          <button type="button" onClick={() => setConfirming(false)} disabled={pending}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-60">
            ← Edit
          </button>
          <button type="button" onClick={doSubmit} disabled={pending}
            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 ${hasDiscrepancy ? "bg-rose-600 hover:bg-rose-700" : "bg-amber-600 hover:bg-amber-700"}`}>
            {pending ? "Building…" : hasDiscrepancy ? "Submit with discrepancy" : "Confirm & Build transmittal"}
          </button>
        </div>
      </div>
    );
  }

  // --- Main form ---
  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="no-print mb-6 space-y-5 rounded-2xl border border-stone-200 bg-white p-5"
    >
      <p className="text-sm font-semibold text-stone-800">Build transmittal</p>

      {/* Turnover date + Source + Mode */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">
            Turnover date
            <span className="ml-1 font-normal text-stone-400">(date cash is handed over, not collection date)</span>
          </label>
          <input type="date" name="date" defaultValue={defaultDate} className={inputCls} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">Source of collection</label>
          <select name="transmittal_source" defaultValue="" className={inputCls}>
            <option value="">All categories</option>
            {COLLECTION_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">Payment mode</label>
          <div className="flex gap-4 py-2">
            {(["cash", "bank_transfer"] as const).map((m) => (
              <label key={m} className="flex cursor-pointer items-center gap-1.5 text-sm">
                <input type="radio" name="payment_mode" value={m} checked={paymentMode === m} onChange={() => setPaymentMode(m)} className="accent-amber-600" />
                {m === "cash" ? "Cash" : "Bank transfer"}
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Collection checkboxes */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-medium text-stone-600">
            Collections to bundle
            <span className="ml-1 font-normal text-stone-400">— select from any date</span>
          </p>
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <span className="text-xs text-stone-500">{selectedIds.size} selected · {peso(selectedTotal)}</span>
            )}
            <button type="button" onClick={() => void load()} className="text-xs text-amber-700 hover:underline">Reload</button>
          </div>
        </div>
        {loadState === "loading" && <p className="py-3 text-sm text-stone-400">Loading collections…</p>}
        {loadState === "error" && <p className="py-2 text-sm text-red-600">{loadErr}</p>}
        {loadState === "empty" && <p className="py-3 text-sm text-stone-400">No un-transmitted collections pending.</p>}

        {loadState === "done" && cols.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-stone-200">
            <div className="flex items-center gap-3 border-b border-stone-200 bg-stone-50 px-4 py-2.5">
              <input type="checkbox" checked={allSelected}
                onChange={() => setSelectedIds(allSelected ? new Set() : new Set(cols.map((c) => c.id)))}
                className="h-4 w-4 accent-amber-600" aria-label="Select all" />
              <span className="text-xs font-medium text-stone-600">Select all</span>
            </div>
            {sortedDates.map((date) => {
              const dateCols = grouped[date];
              const allDateSel = dateCols.every((c) => selectedIds.has(c.id));
              const someDateSel = dateCols.some((c) => selectedIds.has(c.id));
              const dateTotal = dateCols.reduce((s, c) => s + c.amount, 0);
              return (
                <div key={date} className="border-b border-stone-100 last:border-0">
                  <div className="flex items-center gap-3 bg-stone-50 px-4 py-2">
                    <input type="checkbox" checked={allDateSel}
                      ref={(el) => { if (el) el.indeterminate = someDateSel && !allDateSel; }}
                      onChange={() => toggleDate(date)} className="h-4 w-4 accent-amber-600" aria-label={`Select all for ${date}`} />
                    <span className="text-xs font-semibold text-stone-700">{date}</span>
                    <span className="ml-auto text-xs text-stone-400">{dateCols.length} entries · {peso(dateTotal)}</span>
                  </div>
                  {dateCols.map((c) => (
                    <div key={c.id} className="flex items-center gap-3 border-t border-stone-100 px-4 py-2.5 pl-10">
                      <input type="checkbox" checked={selectedIds.has(c.id)} onChange={() => toggleId(c.id)}
                        className="h-4 w-4 flex-shrink-0 accent-amber-600" aria-label={c.or_number ?? c.id} />
                      <span className="w-28 truncate text-sm font-medium text-stone-900">{c.or_number ?? "—"}</span>
                      <span className="flex-1 text-xs text-stone-500">{CAT_LABEL[c.business_line] ?? c.business_line}</span>
                      <span className="text-xs text-stone-400">{PAY_LABEL[c.payment_type] ?? c.payment_type}</span>
                      <span className="w-24 text-right text-sm tabular-nums text-stone-700">{peso(c.amount)}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cash: denomination counter */}
      {paymentMode === "cash" && <DenominationCounter onTotalChange={setDenomTotal} />}

      {/* Bank transfer */}
      {paymentMode === "bank_transfer" && (
        <div className="space-y-4 rounded-xl border border-stone-200 bg-stone-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">Bank transfer details</p>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Sun Miles bank account deposited to</label>
            <select name="bank_account_id" className={inputCls}>
              <option value="">Select bank account…</option>
              {bankAccounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
            </select>
            {bankAccounts.length === 0 && <p className="mt-1 text-xs text-amber-700">No bank accounts configured yet — add them in the Banking module first.</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-stone-600">Proof of payment (screenshot / PDF)</label>
            <input type="file" name="transfer_proof" accept="image/*,.pdf"
              className="text-sm text-stone-600 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-amber-800 hover:file:bg-amber-200" />
            <p className="mt-1 text-[11px] text-stone-400">Max 8 MB. Optional but recommended.</p>
          </div>
        </div>
      )}

      {submitErr && <p className="text-sm text-red-700">{submitErr}</p>}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || selectedIds.size === 0 || loadState === "loading"}
          className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
          {pending ? "Building…" : "Review & Build transmittal"}
        </button>
        {!pending && selectedIds.size === 0 && loadState === "done" && (
          <span className="text-xs text-stone-400">Select at least one collection</span>
        )}
        {!pending && loadState === "done" && selectedIds.size > 0 && (
          <span className="text-xs text-stone-500">
            {selectedIds.size} collection(s) · {peso(selectedTotal)}
            {paymentMode === "cash" && denomTotal > 0 && ` · counted ${peso(denomTotal)}`}
          </span>
        )}
      </div>
    </form>
  );
}
