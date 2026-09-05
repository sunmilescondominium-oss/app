"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setTxnStatus, correctDepositBank } from "@/app/(app)/banking/actions";
import { TXN_KIND_LABEL, type BankTransaction } from "@/lib/banking/types";
import { peso } from "./peso";

const STATUS_CLS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  cleared: "bg-emerald-100 text-emerald-800",
  void: "bg-stone-200 text-stone-500 line-through",
};

function StatusActions({
  txn,
  accountId,
  canWrite,
  accountOptions,
}: {
  txn: BankTransaction;
  accountId: string;
  canWrite: boolean;
  accountOptions: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [showMove, setShowMove] = useState(false);
  const [newAccountId, setNewAccountId] = useState("");
  const [reason, setReason] = useState("");
  const [moveErr, setMoveErr] = useState<string | null>(null);

  if (!canWrite || txn.status === "void") return null;

  const run = (status: "pending" | "cleared" | "void") =>
    start(async () => {
      await setTxnStatus(txn.id, accountId, status);
      router.refresh();
    });

  const doMove = () =>
    start(async () => {
      setMoveErr(null);
      const r = await correctDepositBank(txn.id, newAccountId, reason);
      if (!r.ok) { setMoveErr(r.error); return; }
      setShowMove(false);
      setNewAccountId("");
      setReason("");
      router.refresh();
    });

  const otherAccounts = accountOptions.filter((a) => a.id !== accountId);

  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-2 text-xs">
        {txn.status === "pending" && (
          <button disabled={pending} onClick={() => run("cleared")} className="text-emerald-700 hover:underline disabled:opacity-50">
            Mark cleared
          </button>
        )}
        {txn.status === "cleared" && (
          <button disabled={pending} onClick={() => run("pending")} className="text-amber-700 hover:underline disabled:opacity-50">
            Un-clear
          </button>
        )}
        {txn.kind === "deposit" && txn.status === "pending" && otherAccounts.length > 0 && (
          <button
            disabled={pending}
            onClick={() => setShowMove((v) => !v)}
            className="text-blue-600 hover:underline disabled:opacity-50"
          >
            Move to account
          </button>
        )}
        <button disabled={pending} onClick={() => run("void")} className="text-stone-400 hover:text-rose-600 hover:underline disabled:opacity-50">
          Void
        </button>
      </div>

      {showMove && (
        <div className="mt-1 rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs">
          <p className="mb-2 font-semibold text-blue-800">Move deposit to correct bank account</p>
          <label className="mb-1 block text-stone-600">Correct account</label>
          <select
            value={newAccountId}
            onChange={(e) => setNewAccountId(e.target.value)}
            className="mb-2 w-full rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs"
          >
            <option value="">— select account —</option>
            {otherAccounts.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
          <label className="mb-1 block text-stone-600">Reason (required for audit)</label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Liaison deposited to wrong account"
            className="mb-2 w-full rounded-lg border border-stone-300 bg-white px-2 py-1 text-xs"
          />
          {moveErr && <p className="mb-2 text-rose-600">{moveErr}</p>}
          <div className="flex gap-2">
            <button
              disabled={pending || !newAccountId || !reason.trim()}
              onClick={doMove}
              className="rounded-lg bg-blue-600 px-3 py-1 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {pending ? "Moving…" : "Confirm move"}
            </button>
            <button
              onClick={() => { setShowMove(false); setMoveErr(null); }}
              className="rounded-lg border border-stone-300 bg-white px-3 py-1 text-stone-600 hover:bg-stone-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function Ledger({
  txns,
  accountId,
  canWrite,
  accountOptions = [],
}: {
  txns: BankTransaction[];
  accountId: string;
  canWrite: boolean;
  accountOptions?: { id: string; label: string }[];
}) {
  return (
    <div className="table-wrap">
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
          {txns.length === 0 && (
            <tr>
              <td colSpan={canWrite ? 8 : 7} className="px-4 py-8 text-center text-stone-500">
                No transactions yet.
              </td>
            </tr>
          )}
          {txns.map((t) => (
            <tr key={t.id} className={`border-b border-stone-100 last:border-0 ${t.status === "void" ? "opacity-60" : ""}`}>
              <td className="px-4 py-2.5 text-stone-500">{t.txn_date}</td>
              <td className="px-4 py-2.5 font-medium text-stone-800">{TXN_KIND_LABEL[t.kind]}</td>
              <td className="px-4 py-2.5 text-stone-500">{t.reference ?? "—"}</td>
              <td className="px-4 py-2.5">
                {t.counterparty ?? "—"}
                {t.memo ? <span className="block text-xs text-stone-400">{t.memo}</span> : null}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-rose-700">{t.direction === "out" ? peso(t.amount) : ""}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{t.direction === "in" ? peso(t.amount) : ""}</td>
              <td className="px-4 py-2.5">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[t.status]}`}>
                  {t.status}
                </span>
              </td>
              {canWrite && (
                <td className="px-4 py-2.5">
                  <StatusActions txn={t} accountId={accountId} canWrite={canWrite} accountOptions={accountOptions} />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
