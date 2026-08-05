import Link from "next/link";
import { requireModule, userHasAnyRole } from "@/lib/auth/dal";
import { PageHeader, Badge, Breadcrumb } from "@/components/ui";
import { TableSearch } from "@/components/table-search";
import { listBooklets, listFormTypes, custodianOptions, listBusinessEntities, FORM_MANAGER_ROLES } from "@/lib/forms/queries";
import { RegisterBooklet } from "@/components/forms/register-booklet";
import { BusinessEntities } from "@/components/forms/business-entities";

export const metadata = { title: "Accountable Forms" };

export default async function FormsPage() {
  const user = await requireModule("accountable_forms");
  const canManage = userHasAnyRole(user, FORM_MANAGER_ROLES);
  const [booklets, types, custodians, entities] = await Promise.all([listBooklets(), listFormTypes(), canManage ? custodianOptions() : Promise.resolve([]), listBusinessEntities()]);
  const openBooklets = booklets.filter((b) => b.status === "active").length;

  return (
    <>
      <Breadcrumb items={[{ label: "Accountable Forms" }]} />
      <PageHeader
        title="Accountable Forms"
        subtitle="Serialized OR / AR / checks & other controlled forms — custodian, per-serial status and reconciliation."
        badge={<Badge tone="amber">{openBooklets} active</Badge>}
      />

      {canManage && (
        <div className="mb-4 space-y-3">
          <BusinessEntities entities={entities} />
          <RegisterBooklet types={types} custodians={custodians} entities={entities} />
        </div>
      )}

      <TableSearch placeholder="Search booklets by no., type, custodian…">
        <div className="table-wrap">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3">Booklet</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Serials</th>
                <th className="px-4 py-3">Custodian</th>
                <th className="px-4 py-3 text-right">Accounted</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {booklets.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-stone-500">No booklets registered yet.</td></tr>}
              {booklets.map((b) => (
                <tr key={b.id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-2.5 font-medium"><Link href={`/forms/${b.id}`} className="text-amber-700 hover:underline">{b.bookletNo}</Link></td>
                  <td className="px-4 py-2.5"><Badge tone="slate">{b.typeCode}</Badge> <span className="text-xs text-stone-500">{b.typeName}</span></td>
                  <td className="px-4 py-2.5 text-xs text-stone-600">{b.entityName ?? <span className="text-stone-400">—</span>}{b.birAtpNo && <span className="block text-[11px] text-stone-400">ATP {b.birAtpNo}</span>}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-stone-600">{b.prefix}{b.from}–{b.prefix}{b.to} <span className="text-stone-400">({b.total})</span></td>
                  <td className="px-4 py-2.5 text-stone-600">{b.custodianLabel ?? <span className="text-stone-400">unassigned</span>}{b.custodianRole && <span className="block text-[11px] text-stone-400">{b.custodianRole.replace(/_/g, " ")}</span>}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{b.accounted}/{b.total}<span className="block text-[11px] text-stone-400">{b.counts.unused} unused</span></td>
                  <td className="px-4 py-2.5"><Badge tone={b.status === "active" ? "green" : "slate"}>{b.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableSearch>
    </>
  );
}
