"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { correctShiftPayment } from "../../actions";
import type { ShiftReport, ShiftCorrection } from "@/lib/hotel/session";

const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-PH", {
    timeZone: "Asia/Manila", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

type Payment = ShiftReport["paymentsJson"][number];

function EditPaymentRow({
  payment,
  index,
  reportId,
  onDone,
}: {
  payment: Payment;
  index: number;
  reportId: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [field, setField] = useState<"ar_no" | "amount" | "method" | "guest">("ar_no");
  const [newValue, setNewValue] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  function save() {
    setErr("");
    const oldValue =
      field === "ar_no"  ? (payment.arNo ?? "—")
      : field === "amount" ? String(payment.amount)
      : field === "method" ? payment.method
      : payment.guest;
    start(async () => {
      const res = await correctShiftPayment(reportId, index, field, oldValue, newValue, reason);
      if (!res.ok) { setErr(res.error); return; }
      router.refresh();
      onDone();
    });
  }

  return (
    <div className="mt-2 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
      <p className="text-xs font-semibold text-amber-900">Edit payment #{index + 1} — {payment.guest}</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-0.5 block text-xs text-stone-500">Field to correct</label>
          <select
            value={field}
            onChange={(e) => { setField(e.target.value as typeof field); setNewValue(""); }}
            className="w-full rounded-lg border border-stone-300 px-2 py-1.5 text-xs"
          >
            <option value="ar_no">AR Number</option>
            <option value="amount">Amount</option>
            <option value="method">Payment method</option>
            <option value="guest">Guest label</option>
          </select>
        </div>
        <div>
          <label className="mb-0.5 block text-xs text-stone-500">
            Current: {field === "ar_no" ? (payment.arNo ?? "—") : field === "amount" ? peso(payment.amount) : field === "method" ? payment.method : payment.guest}
          </label>
          <input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="Corrected value"
            className="w-full rounded-lg border border-stone-300 px-2 py-1.5 text-xs"
          />
        </div>
      </div>
      <div>
        <label className="mb-0.5 block text-xs text-stone-500">Reason for correction (required — logged for audit)</label>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Cashier typed wrong AR; extension not recorded in system"
          className="w-full rounded-lg border border-stone-300 px-2 py-1.5 text-xs"
        />
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={save} disabled={pending || !newValue.trim() || !reason.trim()}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
          {pending ? "Saving…" : "Save correction"}
        </button>
        <button type="button" onClick={onDone}
          className="rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-600">
          Cancel
        </button>
      </div>
    </div>
  );
}

export function CorrectionsPanel({
  report,
}: {
  report: Pick<ShiftReport, "id" | "paymentsJson" | "corrections">;
}) {
  const [editIdx, setEditIdx] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {/* Editable payments */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
          Correct payment entries
        </p>
        {report.paymentsJson.length === 0 ? (
          <p className="text-xs text-stone-400">No payments on this report.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-stone-200">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="border-b border-stone-200 bg-stone-50 text-[10px] uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-3 py-2">#</th>
                  <th className="px-3 py-2">AR #</th>
                  <th className="px-3 py-2">Guest</th>
                  <th className="px-3 py-2">Method</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {report.paymentsJson.map((p, i) => (
                  <>
                    <tr key={i} className="border-t border-stone-100">
                      <td className="px-3 py-2 text-stone-400">{i + 1}</td>
                      <td className="px-3 py-2 font-mono">{p.arNo ?? "—"}</td>
                      <td className="px-3 py-2">{p.guest}</td>
                      <td className="px-3 py-2 capitalize">{p.method}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{peso(p.amount)}</td>
                      <td className="px-3 py-2">
                        {editIdx === i ? null : (
                          <button onClick={() => setEditIdx(i)}
                            className="rounded-md border border-amber-300 px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-50">
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                    {editIdx === i && (
                      <tr key={`edit-${i}`}>
                        <td colSpan={6} className="px-3 pb-3">
                          <EditPaymentRow
                            payment={p}
                            index={i}
                            reportId={report.id}
                            onDone={() => setEditIdx(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Correction audit log */}
      {report.corrections.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">
            Correction audit log
          </p>
          <div className="overflow-x-auto rounded-xl border border-amber-200 bg-amber-50">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="border-b border-amber-200 text-[10px] uppercase tracking-wide text-amber-700">
                <tr>
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">By</th>
                  <th className="px-3 py-2">Payment #</th>
                  <th className="px-3 py-2">Field</th>
                  <th className="px-3 py-2">Old</th>
                  <th className="px-3 py-2">New</th>
                  <th className="px-3 py-2">Reason</th>
                </tr>
              </thead>
              <tbody>
                {(report.corrections as ShiftCorrection[]).map((c) => (
                  <tr key={c.id} className="border-t border-amber-100">
                    <td className="px-3 py-1.5 text-stone-500">{fmt(c.correctedAt)}</td>
                    <td className="px-3 py-1.5 font-medium">{c.correctorName ?? "—"}</td>
                    <td className="px-3 py-1.5">{c.paymentIndex != null ? `#${c.paymentIndex + 1}` : "—"}</td>
                    <td className="px-3 py-1.5 capitalize">{c.field.replace("_", " ")}</td>
                    <td className="px-3 py-1.5 font-mono text-rose-700">{c.oldValue ?? "—"}</td>
                    <td className="px-3 py-1.5 font-mono text-emerald-700">{c.newValue}</td>
                    <td className="px-3 py-1.5 text-stone-600">{c.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-[10px] text-stone-400">
            All corrections are permanently logged for audit. Accounting sees these in the final reconciliation.
          </p>
        </div>
      )}
    </div>
  );
}
