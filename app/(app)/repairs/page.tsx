import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { listRepairRequests } from "@/lib/repairs/queries";
import { PageHeader, Badge } from "@/components/ui";
import { RepairsBoard } from "@/components/repairs/repairs-board";

export const metadata = { title: "Repair Requests" };

export default async function RepairsPage() {
  const user = await requireModule("repair");
  const canWrite = canWriteModule(user.roleKeys, "repair");
  const requests = await listRepairRequests();

  const open = requests.filter((r) => r.status !== "completed").length;

  return (
    <>
      <PageHeader
        backHref="/dashboard"
        title="Repair Requests"
        subtitle="Tenant & guest tickets — triage, assign, and track to completion"
        badge={<Badge tone={open > 0 ? "amber" : "green"}>{open} open</Badge>}
      />
      <RepairsBoard requests={requests} canWrite={canWrite} />
      <p className="mt-4 text-xs text-stone-400">
        Public submissions come in via /repair-request and are auto-assigned to
        operations for triage.
      </p>
    </>
  );
}
