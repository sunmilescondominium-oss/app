import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { canWriteModule, canReadModule, canEditCollections } from "@/lib/rbac/modules";
import { getTransmittal, listCustody } from "@/lib/collections/queries";
import { getAllItemTypes } from "@/lib/collections/item-types";
import { summarizeCollections, peso, fmtDateTime } from "@/lib/collections/summary";
import { getAppTimezone } from "@/lib/settings/app-settings";
import { canActOnStage, nextStage, type CustodyStage } from "@/lib/collections/custody";
import { listAccountOptions } from "@/lib/banking/queries";
import { APP_BRAND, PHP_DENOMINATIONS } from "@/lib/config";
import { TransmittalActions } from "@/components/transmittals/transmittal-actions";
import { RevertTransmittal } from "@/components/transmittals/revert-transmittal";
import { ReturnForCorrection } from "@/components/transmittals/return-for-correction";
import { fixTransmittalTotal } from "@/app/(app)/transmittals/actions";
import { CustodyPanel } from "@/components/transmittals/custody-panel";
import { Breadcrumb } from "@/components/ui";
import { listDocPhotos } from "@/lib/docs/photos";
import { PhotoDocPanel } from "@/components/capture/photo-doc-panel";

export const metadata = { title: "Transmittal" };

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  deposited: "Deposited",
  reconciled: "Reconciled",
};

function roleLabel(rk: string | null): string {
  if (!rk) return "—";
  return rk.charAt(0).toUpperCase() + rk.slice(1).replace(/_/g, " ");
}

export default async function TransmittalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireModule("transmittals");
  const [t, tz, allItemTypes] = await Promise.all([getTransmittal(id), getAppTimezone(), getAllItemTypes()]);
  if (!t) notFound();

  // Lookup map: charge_type key → current label (fallback when stored charge_label is stale)
  const chargeTypeMap = new Map(allItemTypes.map((it) => [it.key, it.label]));
  function chargeLabel(c: { charge_type: string | null; charge_label: string | null }): string {
    return chargeTypeMap.get(c.charge_type ?? "") || c.charge_label || c.charge_type || "";
  }

  const summary = summarizeCollections(t.transmittal_date, t.collections);
  const canWrite = canWriteModule(user.roleKeys, "transmittals");

  const currentStage = (t.custody_stage as CustodyStage) ?? "cashier_count";
  const upcoming = nextStage(currentStage);
  const [custodyEvents, bankAccounts] = await Promise.all([
    listCustody(t.id),
    upcoming && (upcoming === "liaison_count" || upcoming === "deposited") ? listAccountOptions() : Promise.resolve([]),
  ]);
  const canActNext = upcoming ? canActOnStage(user.roleKeys, upcoming) : false;
  const docPhotos = await listDocPhotos("transmittal", t.id);
  const canReconcile = user.roleKeys.some((r) =>
    ["accounting", "managing_officer"].includes(r),
  );
  const canRevert = canEditCollections(user.roleKeys);
  const canReturn = user.roleKeys.some((r) => ["accounting", "managing_officer", "admin"].includes(r));
  const isConsultant = user.roleKeys.some((r) => ["consultant", "admin", "managing_officer"].includes(r));
  const totalMismatch = Math.round((summary.grandTotal - Number(t.total_amount)) * 100) !== 0;

  // Derived values for the print form
  const companyName = APP_BRAND.split("—")[0].trim();
  const cashRows = t.collections.filter((c) => c.payment_type === "cash");
  const checkRows = t.collections.filter((c) => c.payment_type === "check");
  const onlineRows = t.collections.filter((c) => c.payment_type !== "cash" && c.payment_type !== "check");
  const cashTotal = cashRows.reduce((s, c) => s + c.amount, 0);
  const checkTotal = checkRows.reduce((s, c) => s + c.amount, 0);
  const onlineTotal = onlineRows.reduce((s, c) => s + c.amount, 0);
  const orNumbers = t.collections.map((c) => c.or_number).filter((n): n is string => n != null && n.trim() !== "").sort();
  const orMin = orNumbers[0] ?? null;
  const orMax = orNumbers[orNumbers.length - 1] ?? null;
  const hasDenominations = t.denomination_counts != null && Object.values(t.denomination_counts).some((n) => Number(n) > 0);
  const blSet = new Set(t.collections.map((c) => c.business_line));
  const blChecks: Record<string, boolean> = {
    Hotel: blSet.has("hotel"),
    Rental: blSet.has("rental"),
    Condo: blSet.has("condo_sales"),
    Parking: blSet.has("parking"),
    Utilities: blSet.has("utility"),
    Other: [...blSet].some((bl) => !["hotel", "rental", "condo_sales", "parking", "utility"].includes(bl)),
  };
  // Receipt types used (AR / SI / OR / PR)
  const receiptTypeSet = new Set(t.collections.map((c) => c.receipt_type).filter(Boolean) as string[]);
  const depositVariance = t.deposited_amount != null
    ? Math.round((Number(t.deposited_amount) - summary.grandTotal) * 100) / 100
    : null;

  return (
    <>
      <Breadcrumb items={[{ label: "Transmittals", href: "/transmittals" }, { label: `Ref ${t.id.slice(0, 8).toUpperCase()}` }]} />

      {/* Printable formal document — Cash Collections Transmittal Report */}
      <div className="rounded-2xl border border-stone-200 bg-white p-6 text-stone-900 print:rounded-none print:border-0 print:p-0">

        {/* ── HEADER ── */}
        <div className="border-b-2 border-stone-800 pb-2 text-center">
          <p className="text-sm font-bold uppercase tracking-wide">{companyName}</p>
          <p className="mt-0.5 text-base font-bold uppercase tracking-widest">Cash Collections Transmittal Report</p>
          <p className="mt-0.5 text-[10px] italic text-stone-500">Rosal St., Brgy. Uno, Calamba City, Laguna 4027</p>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-0.5 text-[11px]">
          <span>Date: <span className="font-medium">{t.transmittal_date}</span></span>
          <span>Ref: <span className="font-medium">{t.id.slice(0, 8).toUpperCase()}</span></span>
          <span>Status: <span className="font-medium">{STATUS_LABEL[t.status] ?? t.status}</span></span>
          <span>Prepared by: <span className="border-b border-stone-400 inline-block min-w-28" /></span>
          <span>Position: <span className="border-b border-stone-400 inline-block min-w-20" /></span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-4 gap-y-0.5 text-[11px]">
          <span>Shift / Period covered: <span className="border-b border-stone-400 inline-block min-w-36" /></span>
          <span className="flex flex-wrap gap-x-3">
            <span className="font-medium">Business line:</span>
            {Object.entries(blChecks).map(([label, checked]) => (
              <span key={label}>[{checked ? "✓" : " "}] {label}</span>
            ))}
          </span>
        </div>
        <div className="mt-2 border-t border-stone-400" />

        {/* ── PART A — COLLECTIONS SUMMARY ── */}
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide">Part A — Collections Summary</p>

          {/* A1. Cash Received */}
          <p className="mb-1 text-[11px] font-semibold">A1. Cash Received</p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border border-stone-700 text-[11px]">
              <thead>
                <tr className="border-b border-stone-700 bg-stone-50">
                  <th className="w-28 border-r border-stone-400 px-2 py-1 text-left font-semibold">Reference Number</th>
                  <th className="w-24 border-r border-stone-400 px-2 py-1 text-left font-semibold">Unit / Room</th>
                  <th className="border-r border-stone-400 px-2 py-1 text-left font-semibold">Type of Collection</th>
                  <th className="w-28 px-2 py-1 text-right font-semibold">Amount (₱)</th>
                </tr>
              </thead>
              <tbody>
                {cashRows.map((c) => (
                  <tr key={c.id} className="border-b border-stone-200">
                    <td className="border-r border-stone-400 px-2 py-0.5 tabular-nums">{c.or_number ?? ""}</td>
                    <td className="border-r border-stone-400 px-2 py-0.5">{c.unit?.unit_number ?? ""}</td>
                    <td className="border-r border-stone-400 px-2 py-0.5">{chargeLabel(c)}</td>
                    <td className="px-2 py-0.5 text-right tabular-nums">{peso(c.amount)}</td>
                  </tr>
                ))}
                <tr className="border-t border-stone-700 font-bold">
                  <td colSpan={3} className="border-r border-stone-400 px-2 py-1">TOTAL CASH</td>
                  <td className="px-2 py-1 text-right tabular-nums">{peso(cashTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* A2. Check Received — hidden if no checks */}
          {checkRows.length > 0 && (
            <>
              <p className="mb-1 mt-3 text-[11px] font-semibold">A2. Check Received</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-stone-700 text-[11px]">
                  <thead>
                    <tr className="border-b border-stone-700 bg-stone-50">
                      <th className="w-28 border-r border-stone-400 px-2 py-1 text-left font-semibold">Reference Number</th>
                      <th className="border-r border-stone-400 px-2 py-1 text-left font-semibold">Bank</th>
                      <th className="w-28 border-r border-stone-400 px-2 py-1 text-left font-semibold">Check Number</th>
                      <th className="w-24 border-r border-stone-400 px-2 py-1 text-left font-semibold">Check Date</th>
                      <th className="w-28 px-2 py-1 text-right font-semibold">Amount (₱)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {checkRows.map((c) => (
                      <tr key={c.id} className="border-b border-stone-200">
                        <td className="border-r border-stone-400 px-2 py-0.5 tabular-nums">{c.or_number ?? ""}</td>
                        <td className="border-r border-stone-400 px-2 py-0.5">{c.check_bank ?? ""}</td>
                        <td className="border-r border-stone-400 px-2 py-0.5 tabular-nums">{c.check_number ?? ""}</td>
                        <td className="border-r border-stone-400 px-2 py-0.5">{c.check_date ?? ""}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{peso(c.amount)}</td>
                      </tr>
                    ))}
                    {/* Check cleared status — screen only */}
                    <tr className="border-t border-stone-700 font-bold">
                      <td colSpan={4} className="border-r border-stone-400 px-2 py-1">TOTAL CHECK</td>
                      <td className="px-2 py-1 text-right tabular-nums">{peso(checkTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              {/* Cleared status for screen readers */}
              <div className="no-print mt-1 flex flex-wrap gap-2">
                {checkRows.map((c) => c.check_number && (
                  <span key={c.id} className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${c.cleared_at ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                    {c.check_number}: {c.cleared_at ? "Cleared" : "Pending"}
                  </span>
                ))}
              </div>
            </>
          )}

          {/* A3. Online / Bank Transfer — hidden if none */}
          {onlineRows.length > 0 && (
            <>
              <p className="mb-1 mt-3 text-[11px] font-semibold">A3. Bank Transfer / Online Payment</p>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-stone-700 text-[11px]">
                  <thead>
                    <tr className="border-b border-stone-700 bg-stone-50">
                      <th className="w-28 border-r border-stone-400 px-2 py-1 text-left font-semibold">Reference Number</th>
                      <th className="w-24 border-r border-stone-400 px-2 py-1 text-left font-semibold">Unit / Room</th>
                      <th className="border-r border-stone-400 px-2 py-1 text-left font-semibold">Type of Collection</th>
                      <th className="w-28 border-r border-stone-400 px-2 py-1 text-left font-semibold">Reference / AR No.</th>
                      <th className="w-28 px-2 py-1 text-right font-semibold">Amount (₱)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {onlineRows.map((c) => (
                      <tr key={c.id} className="border-b border-stone-200">
                        <td className="border-r border-stone-400 px-2 py-0.5 tabular-nums">{c.or_number ?? ""}</td>
                        <td className="border-r border-stone-400 px-2 py-0.5">{c.unit?.unit_number ?? ""}</td>
                        <td className="border-r border-stone-400 px-2 py-0.5">{chargeLabel(c)}</td>
                        <td className="border-r border-stone-400 px-2 py-0.5 tabular-nums">{c.reference_no ?? c.ar_no ?? ""}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{peso(c.amount)}</td>
                      </tr>
                    ))}
                    <tr className="border-t border-stone-700 font-bold">
                      <td colSpan={4} className="border-r border-stone-400 px-2 py-1">TOTAL ONLINE / TRANSFER</td>
                      <td className="px-2 py-1 text-right tabular-nums">{peso(onlineTotal)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Grand Total */}
          <div className="mt-2 flex justify-end border-t-2 border-stone-700 pt-1.5">
            <span className="mr-6 text-[11px] font-bold">GRAND TOTAL (A1{checkRows.length > 0 ? " + A2" : ""}{onlineRows.length > 0 ? " + A3" : ""}):</span>
            <span className="min-w-28 text-right text-[11px] font-bold tabular-nums">{peso(summary.grandTotal)}</span>
          </div>
        </div>

        {/* Mismatch warning — screen only */}
        {totalMismatch && (
          <div className="no-print mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p>⚠ The stored transmittal total ({peso(Number(t.total_amount))}) differs from the current collection sum ({peso(summary.grandTotal)}) — a collection was added or removed after this transmittal was built.</p>
            {isConsultant && (
              <form action={fixTransmittalTotal.bind(null, t.id)} className="mt-2">
                <button type="submit" className="rounded-md bg-amber-700 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-800">
                  Sync total to {peso(summary.grandTotal)}
                </button>
              </form>
            )}
          </div>
        )}

        {/* ── PART B — CASH COUNT ── hidden if no denomination data */}
        {hasDenominations && (
          <div className="mt-4">
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide">Part B — Cash Count Summary</p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse border border-stone-700 text-[11px]">
                <thead>
                  <tr className="border-b border-stone-700 bg-stone-50">
                    <th className="border-r border-stone-400 px-2 py-1 text-left font-semibold">Denomination</th>
                    <th className="w-20 border-r border-stone-400 px-2 py-1 text-center font-semibold">Quantity</th>
                    <th className="w-28 px-2 py-1 text-right font-semibold">Amount (₱)</th>
                  </tr>
                </thead>
                <tbody>
                  {PHP_DENOMINATIONS.filter((d) => {
                    const qty = t.denomination_counts![`${d.kind}-${d.value}`] ?? t.denomination_counts![String(d.value)] ?? 0;
                    return Number(qty) > 0;
                  }).map((d) => {
                    const qty = Number(t.denomination_counts![`${d.kind}-${d.value}`] ?? t.denomination_counts![String(d.value)] ?? 0);
                    return (
                      <tr key={`${d.kind}-${d.value}`} className="border-b border-stone-200">
                        <td className="border-r border-stone-400 px-2 py-0.5">
                          {d.kind === "bill" ? `₱${d.value} bill` : d.value < 1 ? `¢${Math.round(d.value * 100)} coin` : `₱${d.value} coin`}
                        </td>
                        <td className="border-r border-stone-400 px-2 py-0.5 text-center tabular-nums">{qty}</td>
                        <td className="px-2 py-0.5 text-right tabular-nums">{peso(d.value * qty)}</td>
                      </tr>
                    );
                  })}
                  <tr className="border-t border-stone-700 font-bold">
                    <td colSpan={2} className="border-r border-stone-400 px-2 py-1">TOTAL CASH COUNT</td>
                    <td className="px-2 py-1 text-right tabular-nums">{peso(t.counted_cash != null ? Number(t.counted_cash) : cashTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-1.5 text-[11px]">
              Cash count agrees with OR total?&nbsp; [ ] Yes &nbsp; [ ] No
              &nbsp;&nbsp; If No — Discrepancy: ₱ <span className="inline-block min-w-20 border-b border-stone-400" />
              &nbsp; Explanation: <span className="inline-block min-w-44 border-b border-stone-400" />
            </p>
          </div>
        )}

        {/* ── PART C — RECEIPTS USED ── hidden if no receipt numbers */}
        {orNumbers.length > 0 && (
          <div className="mt-4">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide">Part C — Receipts Used</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px]">
              <span className="font-semibold">Type:</span>
              {(["AR", "SI", "OR", "PR"] as const).map((rt) => (
                <label key={rt} className="flex items-center gap-1 cursor-default select-none">
                  <span className="inline-flex h-3.5 w-3.5 items-center justify-center border border-stone-600 text-[10px] font-bold">
                    {receiptTypeSet.has(rt) ? "✓" : ""}
                  </span>
                  {rt === "AR" ? "AR (Acknowledgement Receipt)" : rt === "SI" ? "SI (Sales Invoice)" : rt === "OR" ? "OR (Official Receipt)" : "PR (Payment Receipt)"}
                </label>
              ))}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-6 gap-y-0.5 text-[11px]">
              <span>Series from: <span className="border-b border-stone-400 px-3 font-medium">{orMin}</span></span>
              <span>to: <span className="border-b border-stone-400 px-3 font-medium">{orMax}</span></span>
              <span>Total issued: <span className="font-medium">{orNumbers.length}</span></span>
              <span>Voided: <span className="inline-block min-w-28 border-b border-stone-400" /></span>
            </div>
          </div>
        )}

        {/* ── PART D — TURNOVER RECORD ── */}
        <div className="mt-4">
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide">Part D — Turnover Record</p>
          <div className="text-[11px] space-y-1">
            <div>
              Total amount turned over: ₱&nbsp;<span className="font-bold tabular-nums">{peso(summary.grandTotal)}</span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-0.5">
              <span>Turned over to: <span className="inline-block min-w-32 border-b border-stone-400" /></span>
              <span>Position: <span className="inline-block min-w-20 border-b border-stone-400" /></span>
              <span>Date &amp; Time: <span className="border-b border-stone-400 px-2">{t.transmittal_date}</span> <span className="inline-block min-w-16 border-b border-stone-400" /></span>
            </div>
            <div>
              Bank Booklet / Deposit Slip Ref.: <span className={`border-b border-stone-400 px-2 ${t.deposit_slip_ref ? "font-medium" : ""}`}>{t.deposit_slip_ref ?? ""}</span>
              {!t.deposit_slip_ref && <span className="inline-block min-w-28 border-b border-stone-400" />}
            </div>
          </div>
        </div>

        {/* ── PART E — CERTIFICATION ── */}
        <div className="mt-6">
          <p className="mb-3 text-[11px] font-bold uppercase tracking-wide">Part E — Certification</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
            {[
              { title: "Prepared by", sub: "Cashier / Collector" },
              { title: "Received by", sub: "Cash Count Verified" },
              { title: "Received by", sub: "For Bank Deposit" },
              { title: "Verified by", sub: "After Deposit Slip" },
            ].map((s) => (
              <div key={s.sub} className="min-w-0">
                <div className="h-8 border-b border-stone-700" />
                <p className="mt-1 text-[10px] font-semibold">{s.title}</p>
                <p className="text-[9px] text-stone-500">({s.sub})</p>
                <p className="mt-0.5 text-[9px] text-stone-400">Name / Signature / Date</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── PART F — ACCOUNTING USE ONLY ── */}
        <div className="mt-6 rounded border border-stone-500 p-3">
          <p className="mb-2 border-b border-stone-300 pb-1 text-[11px] font-bold uppercase tracking-wide">Part F — For Accounting Use Only</p>
          <div className="space-y-1 text-[11px]">
            <div className="flex flex-wrap gap-x-6 gap-y-0.5">
              <span>Bank deposit confirmed: [ ] Yes &nbsp; [ ] No</span>
              <span>
                Deposit date: {t.deposited_amount != null
                  ? <span className="border-b border-stone-400 px-2 font-medium">{t.transmittal_date}</span>
                  : <span className="inline-block min-w-24 border-b border-stone-400" />}
              </span>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-0.5">
              <span>
                Deposit slip number: <span className={`border-b border-stone-400 px-2 ${t.deposit_slip_ref ? "font-medium" : ""}`}>{t.deposit_slip_ref ?? ""}</span>
                {!t.deposit_slip_ref && <span className="inline-block min-w-28 border-b border-stone-400" />}
              </span>
              <span>
                Amount deposited: ₱&nbsp;
                {t.deposited_amount != null
                  ? <span className="border-b border-stone-400 px-2 font-medium tabular-nums">{peso(Number(t.deposited_amount))}</span>
                  : <span className="inline-block min-w-24 border-b border-stone-400" />}
              </span>
            </div>
            {depositVariance != null && depositVariance !== 0 && (
              <div className="flex flex-wrap gap-x-6 gap-y-0.5">
                <span>Variance: ₱&nbsp;<span className="font-medium tabular-nums text-amber-700">{peso(Math.abs(depositVariance))} {depositVariance > 0 ? "over" : "short"}</span></span>
                <span>Explanation: <span className="inline-block min-w-44 border-b border-stone-400" /></span>
              </div>
            )}
            <div className="mt-2 flex flex-wrap gap-x-6 gap-y-0.5">
              <span>Filed by: <span className="inline-block min-w-32 border-b border-stone-400" /></span>
              <span>Date filed: <span className="inline-block min-w-24 border-b border-stone-400" /></span>
            </div>
          </div>
        </div>

        {/* Bank transfer proof — screen only */}
        {t.payment_mode === "bank_transfer" && t.transfer_proof_path && (
          <div className="no-print mt-4 rounded-xl border border-stone-200 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-500">Bank transfer proof</p>
            <a
              href={`/api/transmittals/${t.id}/proof`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-amber-700 hover:bg-stone-50 hover:underline"
            >
              View proof →
            </a>
          </div>
        )}

        <p className="mt-6 text-[9px] italic text-stone-400">
          This form must be completed for every cash turnover without exception. File original with Accounting; keep a copy at the collection point.
        </p>
        <p className="mt-1 text-[9px] text-stone-400">{APP_BRAND}</p>
        {t.printed_at && (
          <p className="text-[9px] text-stone-400">Printed {fmtDateTime(t.printed_at, tz)}</p>
        )}
      </div>

      <div className="no-print mt-4">
        <CustodyPanel
          transmittalId={t.id}
          currentStage={currentStage}
          total={t.total_amount}
          events={custodyEvents}
          canActNext={canActNext}
          bankAccounts={bankAccounts}
          returnedForCorrection={Boolean(t.returned_at)}
          returnReason={t.return_reason}
          returnedByRole={t.returned_by_role}
          returnedAt={t.returned_at}
        />
      </div>

      <div className="no-print mt-4 grid gap-3 sm:grid-cols-2">
        <PhotoDocPanel entity="transmittal" entityId={t.id} kind="deposit_slip" title="Deposit slip photo" label="Transmittal · deposit slip" canWrite={canWrite} canView={canReadModule(user.roleKeys, "media")} photos={docPhotos} />
        <PhotoDocPanel entity="transmittal" entityId={t.id} kind="passbook" title="Passbook photo" label="Transmittal · passbook" canWrite={canWrite} canView={canReadModule(user.roleKeys, "media")} photos={docPhotos} />
      </div>

      <div className="no-print mt-4 flex flex-wrap items-center gap-3">
        <TransmittalActions
          id={t.id}
          status={t.status}
          canWrite={canWrite}
          canReconcile={canReconcile}
          passbookReturned={Boolean(t.passbook_returned_on)}
        />
        <RevertTransmittal id={t.id} status={t.status} canRevert={canRevert} />
        <ReturnForCorrection
          transmittalId={t.id}
          canReturn={canReturn && currentStage === "deposited"}
          alreadyReturned={Boolean(t.returned_at)}
          returnReason={t.return_reason}
          returnedByRole={t.returned_by_role}
          returnedAt={t.returned_at}
        />
      </div>
    </>
  );
}
