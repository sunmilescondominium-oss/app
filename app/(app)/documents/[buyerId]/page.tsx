import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { getBuyerFolder } from "@/lib/documents/queries";
import { computeGates } from "@/lib/documents/gates";
import { PageHeader } from "@/components/ui";
import { GateBadges } from "@/components/documents/gate-badges";
import { ConsentPanel } from "@/components/documents/consent-panel";
import { DocRow } from "@/components/documents/doc-row";

export const metadata = { title: "Buyer folder" };

export default async function BuyerFolderPage({
  params,
}: {
  params: Promise<{ buyerId: string }>;
}) {
  const { buyerId } = await params;
  const user = await requireModule("documents");
  const canWrite = canWriteModule(user.roleKeys, "documents");
  const folder = await getBuyerFolder(buyerId);
  if (!folder) notFound();

  const gates = computeGates(
    folder.rows.map((r) => ({
      milestone_gate: r.type.milestone_gate,
      status: r.doc?.status ?? "pending",
    })),
  );

  // Preserve category order as it appears in the (sort_order) rows.
  const categories: string[] = [];
  for (const r of folder.rows) {
    if (!categories.includes(r.type.category)) categories.push(r.type.category);
  }

  const consentGiven = !!folder.buyer.id_consent_at;

  return (
    <>
      <div className="no-print mb-4">
        <Link href="/documents" className="text-sm font-medium text-amber-700 hover:underline">
          ← All folders
        </Link>
      </div>

      <PageHeader
        title={folder.buyer.contact_label}
        subtitle={folder.buyer.unit_number ? `Unit ${folder.buyer.unit_number}` : "No unit"}
        badge={<GateBadges gates={gates} />}
      />

      <div className="mb-6">
        <ConsentPanel buyerId={buyerId} consentAt={folder.buyer.id_consent_at} canWrite={canWrite} />
      </div>

      {categories.map((cat) => (
        <div key={cat} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">{cat}</h2>
          <div className="rounded-2xl border border-stone-200 bg-white px-4">
            {folder.rows
              .filter((r) => r.type.category === cat)
              .map((r) => (
                <DocRow
                  key={r.type.id}
                  buyerId={buyerId}
                  type={r.type}
                  doc={r.doc}
                  canWrite={canWrite}
                  consentGiven={consentGiven}
                />
              ))}
          </div>
        </div>
      ))}
    </>
  );
}
