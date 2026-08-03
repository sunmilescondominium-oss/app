import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { listFolderSummaries } from "@/lib/documents/queries";
import { PageHeader, Badge } from "@/components/ui";
import { GateBadges } from "@/components/documents/gate-badges";

export const metadata = { title: "Documents" };

export default async function DocumentsPage() {
  await requireModule("documents");
  const folders = await listFolderSummaries();

  return (
    <>
      <PageHeader
        backHref="/dashboard"
        title="Documents"
        subtitle="Per-buyer document folders & milestone gates"
        badge={<Badge tone="green">Live</Badge>}
      />

      <div className="table-wrap">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-4 py-3">Buyer</th>
              <th className="px-4 py-3">Unit</th>
              <th className="px-4 py-3">Completeness</th>
              <th className="px-4 py-3">Milestone gates</th>
            </tr>
          </thead>
          <tbody>
            {folders.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-stone-500">
                  No buyers yet — add buyers in the Buyers module first.
                </td>
              </tr>
            )}
            {folders.map((f) => {
              const pct = f.total > 0 ? Math.round((f.done / f.total) * 100) : 0;
              return (
                <tr key={f.buyer_id} className="border-b border-stone-100 last:border-0">
                  <td className="px-4 py-3 font-medium text-stone-900">
                    <Link href={`/documents/${f.buyer_id}`} className="text-amber-700 hover:underline">
                      {f.contact_label}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{f.unit_number ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-28 overflow-hidden rounded-full bg-stone-100">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs tabular-nums text-stone-500">
                        {f.done}/{f.total}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <GateBadges gates={f.gates} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
