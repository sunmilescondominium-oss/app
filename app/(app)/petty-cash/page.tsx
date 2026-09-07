import { requireModule } from "@/lib/auth/dal";
import { listPettyCashFunds, listPettyCashTransactions } from "@/lib/petty-cash/queries";
import { listExpenseCategories, listExpenseVendors } from "@/lib/expenses/queries";
import { listAccountOptions } from "@/lib/banking/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Breadcrumb } from "@/components/ui";
import { LoadFundForm, DisbursementForm, FundSettingsForm } from "@/components/petty-cash/petty-cash-forms";

export const metadata = { title: "Petty Cash" };

const peso = (n: number) => `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default async function PettyCashPage() {
  const user = await requireModule("petty_cash");
  const canWrite = user.roleKeys.some((r) => ["admin", "accounting"].includes(r));

  const [funds, categories, vendors, accounts] = await Promise.all([
    listPettyCashFunds(),
    listExpenseCategories(),
    listExpenseVendors(),
    canWrite ? listAccountOptions() : Promise.resolve([]),
  ]);

  // Load transaction history for first active fund
  const primaryFund = funds[0] ?? null;
  const txns = primaryFund ? await listPettyCashTransactions(primaryFund.id) : [];

  // Staff options for custodian picker (accounting + admin roles)
  let staffOptions: { id: string; name: string }[] = [];
  if (canWrite) {
    const adminSupa = createAdminClient();
    const { data: ur } = await adminSupa
      .from("user_roles")
      .select("user_id, profiles(full_name)")
      .in("role", ["accounting", "accounting_staff", "admin"]);
    staffOptions = (ur ?? [])
      .map((r: Record<string, unknown>) => ({
        id: r.user_id as string,
        name: ((r.profiles as Record<string, unknown> | null)?.full_name as string) ?? r.user_id as string,
      }))
      .filter((s, i, arr) => arr.findIndex((x) => x.id === s.id) === i);
  }

  return (
    <>
      <Breadcrumb items={[{ label: "Dashboard", href: "/dashboard" }, { label: "Petty Cash" }]} />
      <PageHeader
        title="Petty Cash"
        subtitle="Fund balance monitoring, loading from bank & disbursement vouchers."
      />

      {/* Fund balance cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
        {funds.map((f) => {
          const low = f.balance <= f.low_balance_threshold;
          return (
            <div
              key={f.id}
              className={`rounded-2xl border p-4 ${low ? "border-rose-300 bg-rose-50" : "border-stone-200 bg-white"}`}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">{f.name}</p>
              <p className={`mt-1 text-2xl font-bold tabular-nums ${low ? "text-rose-700" : "text-emerald-700"}`}>
                {peso(f.balance)}
              </p>
              {low && (
                <p className="mt-1 text-xs font-medium text-rose-600">
                  Low balance — threshold is {peso(f.low_balance_threshold)}
                </p>
              )}
              {f.custodian_name && (
                <p className="mt-2 text-xs text-stone-500">Custodian: {f.custodian_name}</p>
              )}
              <p className="text-xs text-stone-400">Next PCV: {f.pcv_prefix}-{String(f.pcv_sequence + 1).padStart(3, "0")}</p>
            </div>
          );
        })}
        {funds.length === 0 && (
          <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-500">
            No petty cash funds set up. Apply migration 0105 to create the default fund.
          </div>
        )}
      </div>

      {/* Load & Disburse forms */}
      {canWrite && funds.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2 mb-6">
          <details className="rounded-2xl border border-stone-200 bg-white p-4" open>
            <summary className="cursor-pointer text-sm font-semibold text-emerald-700">Load fund from bank</summary>
            <div className="mt-4">
              <LoadFundForm funds={funds} accounts={accounts} />
            </div>
          </details>
          <details className="rounded-2xl border border-stone-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-semibold text-rose-700">Record disbursement (PCV)</summary>
            <div className="mt-4">
              <DisbursementForm funds={funds} categories={categories} vendors={vendors} />
            </div>
          </details>
        </div>
      )}

      {/* Transaction history */}
      {primaryFund && (
        <>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">
            Transaction history — {primaryFund.name}
          </h2>
          <div className="table-wrap">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">PCV #</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Source / Expense</th>
                  <th className="px-4 py-3 text-right">In</th>
                  <th className="px-4 py-3 text-right">Out</th>
                </tr>
              </thead>
              <tbody>
                {txns.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-stone-500">No transactions yet.</td>
                  </tr>
                )}
                {txns.map((t) => (
                  <tr key={t.id} className="border-b border-stone-100 last:border-0">
                    <td className="px-4 py-2.5 text-stone-500">{t.created_at.slice(0, 10)}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${t.kind === "load" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
                        {t.kind === "load" ? "Load" : "Disbursement"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-stone-500 tabular-nums">{t.pcv_no ?? "—"}</td>
                    <td className="px-4 py-2.5">{t.description ?? "—"}</td>
                    <td className="px-4 py-2.5 text-stone-500">
                      {t.bank_account_label ?? (t.expense_id ? "Expense" : "—")}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">
                      {t.kind === "load" ? peso(t.amount) : ""}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-rose-700">
                      {t.kind === "disbursement" ? peso(t.amount) : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Fund settings */}
      {canWrite && funds.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">Fund Settings</h2>
          {funds.map((f) => (
            <details key={f.id} className="mb-3 rounded-2xl border border-stone-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold text-stone-700">{f.name}</summary>
              <div className="mt-4">
                <FundSettingsForm fund={f} staffOptions={staffOptions} />
              </div>
            </details>
          ))}
        </div>
      )}
    </>
  );
}
