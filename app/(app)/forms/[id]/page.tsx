import { notFound } from "next/navigation";
import { requireModule, userHasAnyRole } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { PageHeader, Badge, Breadcrumb } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { bookletDetail, custodianOptions, FORM_MANAGER_ROLES } from "@/lib/forms/queries";
import { SERIAL_STATUSES } from "@/lib/forms/types";
import { SerialGrid } from "@/components/forms/serial-grid";
import { CustodyPanel } from "@/components/forms/custody";
import { ReprintButton } from "@/components/forms/reprint-button";
import { DeleteBookletButton } from "@/components/forms/delete-booklet-button";
import { LOW_STOCK_THRESHOLD } from "@/lib/forms/types";
import { APP_BRAND_SHORT } from "@/lib/config";

export default async function BookletDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireModule("accountable_forms");
  const canWrite = canWriteModule(user.roleKeys, "accountable_forms");
  const canManage = userHasAnyRole(user, FORM_MANAGER_ROLES);
  const isConsultant = user.roleKeys.includes("consultant");
  const [data, custodians] = await Promise.all([bookletDetail(id), canManage ? custodianOptions() : Promise.resolve([])]);
  if (!data) notFound();
  const { booklet, serials, custody } = data;

  return (
    <>
      <Breadcrumb items={[{ label: "Accountable Forms", href: "/forms" }, { label: booklet.bookletNo }]} />
      <div className="no-print flex items-center justify-between gap-3">
        <PageHeader
          title={`${booklet.typeCode} · ${booklet.bookletNo}`}
          subtitle={`Serials ${booklet.prefix}${booklet.from}–${booklet.prefix}${booklet.to} · custodian: ${booklet.custodianLabel ?? "unassigned"}`}
          badge={<Badge tone={booklet.status === "active" ? "green" : "slate"}>{booklet.status}</Badge>}
        />
        <div className="flex items-center gap-2">
          {canWrite && <ReprintButton bookletId={id} low={booklet.status === "active" && booklet.counts.unused <= LOW_STOCK_THRESHOLD} requested={Boolean(booklet.reprintRequestedAt)} />}
          <PrintButton label="Print reconciliation" />
          {isConsultant && <DeleteBookletButton bookletId={id} bookletNo={booklet.bookletNo} />}
        </div>
      </div>

      {(booklet.issuedToRole || booklet.issuedToLabel || booklet.businessLine) && (
        <div className="no-print mb-4 rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs text-stone-600">
          <span className="font-medium text-stone-700">Issued for use:</span> {booklet.issuedToLabel || booklet.issuedToRole?.replace(/_/g, " ") || "—"}
          {booklet.businessLine && <span> · business: {booklet.businessLine}</span>}
        </div>
      )}
      {canWrite && booklet.status === "active" && booklet.counts.unused <= LOW_STOCK_THRESHOLD && !booklet.reprintRequestedAt && (
        <div className="no-print mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">⚠ Only {booklet.counts.unused} serial(s) left — consider requesting a reprint.</div>
      )}

      <div className="mb-4 hidden border-b border-stone-300 pb-3 print:block">
        <p className="text-lg font-bold">{booklet.entityName ?? APP_BRAND_SHORT}</p>
        {booklet.entityTin && <p className="text-xs">TIN: {booklet.entityTin}</p>}
        <p className="text-sm">Accountable Form Reconciliation — {booklet.typeName} · {booklet.bookletNo}</p>
        <p className="text-xs">Serials {booklet.prefix}{booklet.from}–{booklet.prefix}{booklet.to} · Custodian: {booklet.custodianLabel ?? "unassigned"}</p>
        {(booklet.birAtpNo || booklet.printerName) && (
          <p className="text-xs">BIR ATP: {booklet.birAtpNo ?? "—"}{booklet.birAtpDate ? ` (${booklet.birAtpDate})` : ""}{booklet.printerName ? ` · Printer: ${booklet.printerName}` : ""}</p>
        )}
      </div>

      {/* On-screen BIR banner */}
      {(booklet.entityName || booklet.birAtpNo) && (
        <div className="no-print mb-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-xs text-stone-600">
          <span className="font-medium text-stone-700">{booklet.entityName ?? "No business assigned"}</span>
          {booklet.entityTin && <span> · TIN {booklet.entityTin}</span>}
          {booklet.birAtpNo && <span> · BIR ATP {booklet.birAtpNo}{booklet.birAtpDate ? ` (${booklet.birAtpDate})` : ""}</span>}
          {booklet.printerName && <span> · Printer: {booklet.printerName}</span>}
        </div>
      )}

      {/* Reconciliation summary */}
      <div className="mb-6 grid grid-cols-3 gap-3 sm:grid-cols-6">
        {(["unused", ...SERIAL_STATUSES.slice(1)] as const).map((st) => (
          <div key={st} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-center">
            <p className="text-xl font-bold tabular-nums text-stone-900">{booklet.counts[st]}</p>
            <p className="text-[11px] capitalize text-stone-500">{st}</p>
          </div>
        ))}
      </div>
      <p className="mb-6 text-sm text-stone-600">
        <strong>{booklet.accounted}</strong> of <strong>{booklet.total}</strong> serials accounted (used/cancelled/spoiled/void); <strong>{booklet.counts.unused}</strong> still unused in the booklet.
      </p>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <SerialGrid serials={serials} canWrite={canWrite && booklet.status === "active"} />
        <CustodyPanel bookletId={id} custodians={custodians} custody={custody} canManage={canManage} />
      </div>

      {/* Sign-off — prints */}
      <div className="mt-10 hidden grid-cols-2 gap-12 print:grid">
        <div><div className="mt-10 border-t border-stone-800" /><p className="text-xs">Custodian — signature over printed name &amp; date</p></div>
        <div><div className="mt-10 border-t border-stone-800" /><p className="text-xs">Verified by (Accounting / Owner) — signature &amp; date</p></div>
      </div>
    </>
  );
}
