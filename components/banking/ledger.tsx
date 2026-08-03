"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTxnStatus } from "@/app/(app)/banking/actions";
import { TXN_KIND_LABEL, type BankTransaction } from "@/lib/banking/types";
import { peso } from "./peso";

const STATUS_CLS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  cleared: "bg-emerald-100 text-emerald-800",
  void: "bg-stone-200 text-stone-500 line-through",
};

function StatusActions({ txn, accountId, canWrite }: { txn: BankTransaction; accountId: string; canWrite: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (!canWrite || txn.status === "void") return null;
  const run = (status: "pending" | "cleared" | "void") =>
    start(async () => { await setTxnStatus(txn.id, accountId, status); router.refresh(); });
  return (
    <div className="flex gap-2 text-xs">
      {txn.status === "pending" && <button disabled={pending} onClick={() => run("cleared")} className="text-emerald-700 hover:underline disabled:opacity-50">Mark cleared</button>}
      {txn.status === "cleared" && <button disabled={pending} onClick={() => run("pending")} className="text-amber-700 hover:underline disabled:opacity-50">Un-clear</button>}
      <button disabled={pending} onClick={() => run("void")} className="text-stone-400 hover:text-rose-600 hover:underline disabled:opacity-50">Void</button>
    </div>
  );
}

export function Ledger({ txns, accountId, canWrite }: { txns: BankTransaction[]; accountId: string; canWrite: boolean }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
          <tr>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Ref</th>
            <th className="px-4 py-3">Payee / source</th>
            <th className="px-4 py-3 text-right">Out</th>
            <th className="px-4 py-3 text-right">In</th>
            <th className="px-4 py-3">Status</th>
            {canWrite && <th className="px-4 py-3" />}
          </tr>
        </thead>
        <tbody>
          {txns.length === 0 && <tr><td colSpan={canWrite ? 8 : 7} className="px-4 py-8 text-center text-stone-500">No transactions yet.</td></tr>}
          {txns.map((t) => (
            <tr key={t.id} className={`border-b border-stone-100 last:border-0 ${t.status === "void" ? "opacity-60" : ""}`}>
              <td className="px-4 py-2.5 text-stone-500">{t.txn_date}</td>
              <td className="px-4 py-2.5 font-medium text-stone-800">{TXN_KIND_LABEL[t.kind]}</td>
              <td className="px-4 py-2.5 text-stone-500">{t.reference ?? "—"}</td>
              <td className="px-4 py-2.5">{t.counterparty ?? "—"}{t.memo ? <span className="block text-xs text-stone-400">{t.memo}</span> : null}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-rose-700">{t.direction === "out" ? peso(t.amount) : ""}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{t.direction === "in" ? peso(t.amount) : ""}</td>
              <td className="px-4 py-2.5"><span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[t.status]}`}>{t.status}</span></td>
              {canWrite && <td className="px-4 py-2.5"><StatusActions txn={t} accountId={accountId} canWrite={canWrite} /></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
