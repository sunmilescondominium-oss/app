"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { decideDtrAdjustment } from "@/app/(app)/hr/actions";
import type { DtrAdjustment } from "@/lib/hr/queries";

const STATUS_CLS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

const span = (i: string | null, o: string | null) => `${i ?? "—"}–${o ?? "—"}`;

export function DtrAdjustments({ adjustments, canApprove }: { adjustments: DtrAdjustment[]; canApprove: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const pending = adjustments.filter((a) => a.status === "pending").length;

  async function decide(id: string, decision: "approved" | "rejected") {
    let note: string | undefined;
    if (decision === "rejected") { note = window.prompt("Reason for rejecting (this reverts the record):") ?? undefined; }
    setBusy(id);
    const res = await decideDtrAdjustment(id, decision, note);
    setBusy(null);
    if (!res.ok) { window.alert(res.error); return; }
    router.refresh();
  }

  return (
    <section className="mb-8">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
        Attendance corrections / discrepancies
        {pending > 0 && <span className="no-print ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">{pending} pending owner approval</span>}
      </h2>

      {adjustments.length === 0 ? (
        <p className="text-sm text-stone-500">No DTR corrections in this period.</p>
      ) : (
        <div className="table-wrap">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-3 py-2">Staff</th>
                <th className="px-3 py-2">Date</th>
                <th className="px-3 py-2">Change (was → now)</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2">By</th>
                <th className="px-3 py-2">Owner approval</th>
                <th className="no-print px-3 py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map((a) => (
                <tr key={a.id} className="border-b border-stone-100 align-top last:border-0">
                  <td className="px-3 py-2 font-medium text-stone-800">{a.label}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-stone-600">{a.workDate}</td>
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                    <span className="text-stone-400 line-through">{a.action === "delete" ? span(a.oldIn, a.oldOut) : span(a.oldIn, a.oldOut)}</span>
                    {a.action !== "delete" && <span className="text-stone-800"> → {span(a.newIn, a.newOut)}</span>}
                    <span className="ml-1 text-[10px] uppercase text-stone-400">{a.action}</span>
                  </td>
                  <td className="px-3 py-2 text-stone-600">{a.reason ?? "—"}</td>
                  <td className="px-3 py-2 whitespace-nowrap text-xs text-stone-500">{a.changedByRole?.replace(/_/g, " ") ?? "—"}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CLS[a.status]}`}>{a.status}</span>
                    {a.approvedByRole && <span className="ml-1 block text-[10px] text-stone-400">{a.approvedByRole.replace(/_/g, " ")}</span>}
                    {a.decisionNote && <span className="block text-[10px] text-stone-400">{a.decisionNote}</span>}
                  </td>
                  <td className="no-print px-3 py-2 text-right">
                    {a.status === "pending" && canApprove ? (
                      <div className="flex justify-end gap-1.5">
                        <button type="button" onClick={() => decide(a.id, "approved")} disabled={busy === a.id} className="rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">Approve</button>
                        <button type="button" onClick={() => decide(a.id, "rejected")} disabled={busy === a.id} className="rounded-md border border-rose-300 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50">Reject</button>
                      </div>
                    ) : a.status === "pending" ? (
                      <span className="text-xs text-stone-400">awaiting owner</span>
                    ) : (
                      <span className="text-xs text-stone-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Owner/CEO sign-off — prints on the payroll. */}
      {adjustments.length > 0 && (
        <div className="mt-6 hidden print:block">
          <p className="mb-6 text-xs text-stone-600">The attendance corrections above are reviewed and approved by:</p>
          <div className="flex gap-16">
            <div>
              <div className="mt-8 w-64 border-t border-stone-800" />
              <p className="text-xs">Owner / CEO — signature over printed name &amp; date</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
