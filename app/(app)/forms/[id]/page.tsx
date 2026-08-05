import { notFound } from "next/navigation";
import { requireModule, userHasAnyRole } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { PageHeader, Badge, Breadcrumb } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { bookletDetail, custodianOptions, FORM_MANAGER_ROLES } from "@/lib/forms/queries";
import { SERIAL_STATUSES } from "@/lib/forms/types";
import { SerialGrid } from "@/components/forms/serial-grid";
import { CustodyPanel } from "@/components/forms/custody";
import { APP_BRAND_SHORT } from "@/lib/config";

export default async function BookletDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireModule("accountable_forms");
  const canWrite = canWriteModule(user.roleKeys, "accountable_forms");
  const canManage = userHasAnyRole(user, FORM_MANAGER_ROLES);
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
        <PrintButton label="Print reconciliation" />
      </div>

      <div className="mb-4 hidden border-b border-stone-300 pb-3 print:block">
        <p className="text-lg font-bold">{APP_BRAND_SHORT}</p>
        <p className="text-sm">Accountable Form Reconciliation — {booklet.typeName} · {booklet.bookletNo}</p>
        <p className="text-xs">Serials {booklet.prefix}{booklet.from}–{booklet.prefix}{booklet.to} · Custodian: {booklet.custodianLabel ?? "unassigned"}</p>
      </div>

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
