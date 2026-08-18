import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { getBuyerDetail } from "@/lib/buyers/queries";
import { listUnitOptions } from "@/lib/collections/queries";
import { peso, fmtDateTime } from "@/lib/collections/summary";
import { getAppTimezone } from "@/lib/settings/app-settings";
import { APP_BRAND_SHORT, BUYER_STATUSES, PAYMENT_SCHEMES } from "@/lib/config";
import { PrintButton } from "@/components/print-button";
import { BuyerDetailActions } from "@/components/buyers/buyer-detail-actions";

export const metadata = { title: "Buyer" };

const STATUS_CLS: Record<string, string> = {
  current: "bg-emerald-100 text-emerald-800",
  overdue: "bg-red-100 text-red-700",
  restructured: "bg-amber-100 text-amber-800",
  in_dispute: "bg-stone-200 text-stone-700",
};
const STATUS_LABEL = Object.fromEntries(BUYER_STATUSES.map((s) => [s.key, s.label]));
const SCHEME_LABEL = Object.fromEntries(PAYMENT_SCHEMES.map((s) => [s.key, s.label]));
const ROW_CLS: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-800",
  partial: "bg-amber-100 text-amber-800",
  due: "bg-red-100 text-red-700",
  upcoming: "bg-stone-100 text-stone-600",
};

export default async function BuyerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireModule("buyers");
  const canWrite = canWriteModule(user.roleKeys, "buyers");
  const detail = await getBuyerDetail(id);
  if (!detail) notFound();

  const [unitOptions, tz] = await Promise.all([
    canWrite ? listUnitOptions() : Promise.resolve([]),
    getAppTimezone(),
  ]);
  const { buyer, payments, soa, soaMeta } = detail;

  const info: [string, string][] = [
    ["Unit", buyer.unit?.unit_number ?? "—"],
    ["Scheme", SCHEME_LABEL[buyer.payment_scheme] ?? buyer.payment_scheme],
    ["TCP", peso(buyer.tcp ?? buyer.unit?.tcp ?? 0)],
    ["Down payment", peso(buyer.downpayment)],
    ["Term", `${buyer.term_months} months`],
    ["Interest / yr", buyer.annual_interest_rate != null ? String(buyer.annual_interest_rate) : "default"],
    ["Start date", buyer.start_date],
    ["Portal PIN", buyer.ref_pin],
  ];

  return (
    <>
      <div className="no-print mb-4">
        <Link href="/buyers" className="text-sm font-medium text-amber-700 hover:underline">
          ← All buyers
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            {buyer.contact_label}
          </h1>
          <p className="mt-1 text-sm text-stone-500">
            {buyer.unit?.property_name ? `${buyer.unit.property_name} · ` : ""}
            {buyer.unit?.unit_number ?? "no unit"}
          </p>
        </div>
        <span
          className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${
            STATUS_CLS[buyer.payment_status] ?? "bg-stone-100 text-stone-700"
          }`}
        >
          {STATUS_LABEL[buyer.payment_status] ?? buyer.payment_status}
        </span>
      </div>

      <div className="no-print mb-4 flex flex-wrap items-center gap-2">
        <BuyerDetailActions buyer={buyer} unitOptions={unitOptions} canWrite={canWrite} />
        <PrintButton label="Print Statement of Account" />
      </div>

      {/* Printable Statement of Account */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 print:rounded-none print:border-0 print:p-0">
        <div className="mb-4 hidden border-b border-stone-200 pb-3 print:block">
          <p className="text-lg font-bold">{APP_BRAND_SHORT}</p>
          <p className="text-sm">Statement of Account — {buyer.contact_label}</p>
        </div>

        <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-4">
          {info.map(([k, v]) => (
            <div key={k}>
              <p className="text-[11px] uppercase tracking-wide text-stone-400">{k}</p>
              <p className="text-sm font-medium text-stone-800">{v}</p>
            </div>
          ))}
        </div>

        {soa ? (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["Contract balance", peso(soa.totals.contract_balance)],
                ["Amount due now", peso(soa.totals.amount_due_now)],
                ["Total paid", peso(soa.totals.total_paid)],
                ["Penalty", peso(soa.totals.total_penalty)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl border border-stone-200 px-4 py-3">
                  <p className="text-lg font-bold tabular-nums text-stone-900">{v}</p>
                  <p className="text-xs text-stone-500">{k}</p>
                </div>
              ))}
            </div>
            {soa.next_due_date && (
              <p className="mt-3 text-sm text-stone-600">
                Next due date: <strong>{soa.next_due_date}</strong>
              </p>
            )}

            <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-stone-500">
              Amortization schedule
            </h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="py-2 pr-2">#</th>
                    <th className="py-2 pr-2">Due</th>
                    <th className="py-2 pr-2 text-right">Payment</th>
                    <th className="py-2 pr-2 text-right">Interest</th>
                    <th className="py-2 pr-2 text-right">Principal</th>
                    <th className="py-2 pr-2 text-right">Penalty</th>
                    <th className="py-2 pr-2 text-right">Balance</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {soa.schedule.map((r) => (
                    <tr key={r.n} className="border-b border-stone-100">
                      <td className="py-1.5 pr-2 text-stone-500">{r.n}</td>
                      <td className="py-1.5 pr-2">{r.due_date}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{peso(r.scheduled_payment)}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{peso(r.interest)}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{peso(r.principal)}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{r.penalty ? peso(r.penalty) : "—"}</td>
                      <td className="py-1.5 pr-2 text-right tabular-nums">{peso(r.balance_after)}</td>
                      <td className="py-1.5">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${ROW_CLS[r.status] ?? ""}`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {soaMeta && (
              <p className="mt-4 text-[10px] text-stone-400">
                Computed via {soaMeta.source} driver · params v{soaMeta.params_version ?? "?"} ·{" "}
                {fmtDateTime(soaMeta.created_at, tz)}
              </p>
            )}
          </>
        ) : (
          <p className="mt-6 rounded-lg bg-stone-50 px-4 py-3 text-sm text-stone-500">
            No SOA computed yet. {canWrite && "Use “Regenerate SOA”."}
          </p>
        )}
      </div>

      {/* Payment history */}
      <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-stone-500">
        Payment history
      </h2>
      <div className="mt-2 table-wrap">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3">Doc</th>
              <th className="px-4 py-3">OR #</th>
              <th className="px-4 py-3 text-right">Amount</th>
              <th className="px-4 py-3">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-stone-500">
                  No payments recorded yet.
                </td>
              </tr>
            )}
            {payments.map((p) => (
              <tr key={p.id} className="border-b border-stone-100 last:border-0">
                <td className="px-4 py-2.5">{p.paid_on}</td>
                <td className="px-4 py-2.5">{p.doc_type}</td>
                <td className="px-4 py-2.5">{p.or_number ?? "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{peso(p.amount)}</td>
                <td className="px-4 py-2.5 text-stone-500">{p.remarks ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
