import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { listRepairRequests } from "@/lib/repairs/queries";
import { PageHeader, Badge } from "@/components/ui";
import { RepairsBoard } from "@/components/repairs/repairs-board";
import { getLang } from "@/lib/i18n-server";
import { t as tt } from "@/lib/i18n";

export const metadata = { title: "Repair Requests" };

export default async function RepairsPage() {
  const user = await requireModule("repair");
  const lang = await getLang();
  const canWrite = canWriteModule(user.roleKeys, "repair");
  const requests = await listRepairRequests();

  const open = requests.filter((r) => r.status !== "completed").length;

  return (
    <>
      <PageHeader
        backHref="/dashboard"
        title={tt(lang, "rp_title")}
        subtitle={tt(lang, "rp_sub")}
        badge={<Badge tone={open > 0 ? "amber" : "green"}>{open} {tt(lang, "rp_open")}</Badge>}
      />
      <RepairsBoard requests={requests} canWrite={canWrite} />
      <p className="mt-4 text-xs text-stone-400">
        Public submissions come in via /repair-request and are auto-assigned to
        operations for triage.
      </p>
    </>
  );
}
