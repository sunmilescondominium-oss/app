import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { listDisputes } from "@/lib/disputes/queries";
import { listUnitOptions } from "@/lib/collections/queries";
import { PageHeader, Badge } from "@/components/ui";
import { DisputesPanel } from "@/components/disputes/disputes-panel";

export const metadata = { title: "Disputes" };

export default async function DisputesPage() {
  const user = await requireModule("disputes");
  const canWrite = canWriteModule(user.roleKeys, "disputes");
  const canSeeLawyerNotes = user.roleKeys.includes("consultant");

  const disputes = await listDisputes(canSeeLawyerNotes);
  const unitOptions = canWrite ? await listUnitOptions() : [];

  const active = disputes.filter((d) => !d.is_reference);
  const references = disputes.filter((d) => d.is_reference);

  return (
    <>
      <PageHeader
        backHref="/dashboard"
        title="Disputes"
        subtitle="Case log per unit, with the historical reference library"
        badge={<Badge tone="green">Live</Badge>}
      />
      <DisputesPanel
        active={active}
        references={references}
        unitOptions={unitOptions}
        canWrite={canWrite}
        canSeeLawyerNotes={canSeeLawyerNotes}
        canHardDelete={["admin", "managing_officer", "consultant"].some((r) => user.roleKeys.includes(r))}
      />
      {!canWrite && (
        <p className="mt-4 text-xs text-stone-400">You have view-only access to disputes.</p>
      )}
    </>
  );
}
