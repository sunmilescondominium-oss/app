import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { listAccountsWithBalances } from "@/lib/banking/queries";
import { ACCOUNT_TYPE_LABEL } from "@/lib/banking/types";
import { PageHeader, Badge } from "@/components/ui";
import { AccountForm } from "@/components/banking/account-form";
import { peso } from "@/components/banking/peso";

export const metadata = { title: "Bank & Reconciliation" };

const TYPE_CLS: Record<string, string> = {
  collection: "bg-emerald-100 text-emerald-800",
  disbursement: "bg-rose-100 text-rose-800",
  payroll: "bg-amber-100 text-amber-800",
  general: "bg-slate-100 text-slate-700",
};

export default async function BankingPage() {
  const user = await requireModule("banking");
  const canWrite = user.roleKeys.some((r) => ["accounting", "admin"].includes(r));
  const accounts = await listAccountsWithBalances();
  const totalBook = accounts.reduce((s, a) => s + a.balances.book, 0);

  return (
    <>
      <PageHeader
        title="Bank & Reconciliation"
        subtitle="Multiple accounts · deposits, check release & bank reconciliation"
        badge={<Badge tone="green">{peso(totalBook)} across {accounts.length}</Badge>}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {accounts.map(({ account, balances }) => (
          <Link
            key={account.id}
            href={`/banking/${account.id}`}
            className={`rounded-2xl border bg-white p-4 transition hover:shadow-md ${account.is_active ? "border-slate-200" : "border-slate-200 opacity-60"}`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">{account.label}</p>
                <p className="text-xs text-slate-500">{account.bank_name ?? "—"} {account.account_no_masked ?? ""}</p>
              </div>
              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_CLS[account.account_type] ?? ""}`}>
                {ACCOUNT_TYPE_LABEL[account.account_type]}
              </span>
            </div>
            <p className="mt-3 text-2xl font-bold tabular-nums text-slate-900">{peso(balances.book)}</p>
            <p className="text-xs text-slate-500">Available (book) balance</p>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
              <span>Cleared: <span className="tabular-nums text-slate-700">{peso(balances.cleared)}</span></span>
              {balances.depositsInTransit > 0 && <span>In transit: <span className="tabular-nums text-emerald-700">{peso(balances.depositsInTransit)}</span></span>}
              {balances.outstandingChecks > 0 && <span>Outstanding: <span className="tabular-nums text-rose-700">{peso(balances.outstandingChecks)}</span></span>}
            </div>
          </Link>
        ))}
        {accounts.length === 0 && <p className="text-sm text-slate-500">No bank accounts yet.</p>}
      </div>

      {canWrite && (
        <div className="mt-4">
          <AccountForm />
        </div>
      )}
    </>
  );
}
