import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { getAccount, listTransactions, foldBalances, listReconciliations } from "@/lib/banking/queries";
import { listTransmittals } from "@/lib/collections/queries";
import { ACCOUNT_TYPE_LABEL } from "@/lib/banking/types";
import { PageHeader, Breadcrumb } from "@/components/ui";
import { peso } from "@/components/banking/peso";
import { Ledger } from "@/components/banking/ledger";
import { AccountForm } from "@/components/banking/account-form";
import { DepositForm, CheckForm, EntryForm, ReconcileForm } from "@/components/banking/txn-forms";

export const metadata = { title: "Bank account" };

export default async function BankAccountPage({ params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params;
  const user = await requireModule("banking");
  const canWrite = user.roleKeys.some((r) => ["accounting", "admin"].includes(r));

  const account = await getAccount(accountId);
  if (!account) notFound();

  const [txns, recons, transmittals] = await Promise.all([
    listTransactions(accountId),
    listReconciliations(accountId),
    canWrite ? listTransmittals(40) : Promise.resolve([]),
  ]);
  const balances = foldBalances(account.opening_balance, txns);
  const txOptions = transmittals.map((t) => ({
    id: t.id,
    label: `${t.transmittal_date} · ${t.business_line ?? "combined"} · ${peso(t.total_amount)}`,
  }));

  const stat = (label: string, value: number, tone = "text-stone-900") => (
    <div className="rounded-xl border border-stone-200 bg-white p-3">
      <p className="text-xs text-stone-500">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${tone}`}>{peso(value)}</p>
    </div>
  );

  return (
    <>
      <Breadcrumb items={[{ label: "Bank & Reconciliation", href: "/banking" }, { label: account.label }]} />
      <PageHeader
        title={account.label}
        subtitle={`${ACCOUNT_TYPE_LABEL[account.account_type]} · ${account.bank_name ?? "—"} ${account.account_no_masked ?? ""}`}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stat("Available (book)", balances.book)}
        {stat("Cleared", balances.cleared, "text-emerald-700")}
        {stat("Deposits in transit", balances.depositsInTransit, "text-emerald-700")}
        {stat("Outstanding checks", balances.outstandingChecks, "text-rose-700")}
      </div>

      {canWrite && (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <details className="rounded-2xl border border-stone-200 bg-white p-4" open>
            <summary className="cursor-pointer text-sm font-semibold text-emerald-700">Record deposit</summary>
            <div className="mt-3"><DepositForm accountId={accountId} transmittals={txOptions} /></div>
          </details>
          <details className="rounded-2xl border border-stone-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-rose-700">Release check</summary>
            <div className="mt-3"><CheckForm accountId={accountId} available={balances.book} /></div>
          </details>
          <details className="rounded-2xl border border-stone-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-stone-700">Other entry (withdrawal, charge, interest…)</summary>
            <div className="mt-3"><EntryForm accountId={accountId} /></div>
          </details>
          <details className="rounded-2xl border border-stone-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-indigo-700">Bank reconciliation</summary>
            <div className="mt-3"><ReconcileForm accountId={accountId} clearedBalance={balances.cleared} /></div>
          </details>
        </div>
      )}

      <h2 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Ledger</h2>
      <Ledger txns={txns} accountId={accountId} canWrite={canWrite} />

      {recons.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">Reconciliation history</h2>
          <div className="table-wrap">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3">Statement date</th>
                  <th className="px-4 py-3 text-right">Statement</th>
                  <th className="px-4 py-3 text-right">Book (cleared)</th>
                  <th className="px-4 py-3 text-right">Difference</th>
                  <th className="px-4 py-3">By</th>
                  <th className="px-4 py-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {recons.map((r) => (
                  <tr key={r.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-2.5">{r.statement_date}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{peso(r.statement_balance)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{peso(r.book_cleared_balance)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${Math.abs(r.difference) < 0.01 ? "text-emerald-700" : "text-rose-700"}`}>{peso(r.difference)}</td>
                    <td className="px-4 py-2.5 capitalize">{r.reconciled_by_role?.replace(/_/g, " ") ?? "—"}</td>
                    <td className="px-4 py-2.5 text-stone-500">{r.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {canWrite && (
        <details className="mt-6 rounded-2xl border border-stone-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-stone-600">Edit account settings</summary>
          <div className="mt-3"><AccountForm account={account} /></div>
        </details>
      )}
    </>
  );
}
