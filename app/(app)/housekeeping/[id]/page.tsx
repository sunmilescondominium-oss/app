import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { canWriteModule, canReadModule } from "@/lib/rbac/modules";
import { getTaskDetail } from "@/lib/housekeeping/queries";
import { HOUSEKEEPING_STATUSES } from "@/lib/config";
import { fmtDateTime } from "@/lib/collections/summary";
import { getAppTimezone } from "@/lib/settings/app-settings";
import { PageHeader, Badge } from "@/components/ui";
import { TaskActions } from "@/components/housekeeping/task-actions";
import { CleaningPhotos } from "@/components/housekeeping/cleaning-photos";
import { listDocPhotos } from "@/lib/docs/photos";
import { PhotoDocPanel } from "@/components/capture/photo-doc-panel";
import { getLang } from "@/lib/i18n-server";
import { t as tt } from "@/lib/i18n";
import { isHousekeepingHardStop } from "@/lib/settings/flags";
import { getShiftEndToday } from "@/lib/housekeeping/shift";

export const metadata = { title: "Housekeeping task" };

const STATUS_LABEL = Object.fromEntries(HOUSEKEEPING_STATUSES.map((s) => [s.key, s.label]));
const STATUS_KEY: Record<string, string> = { pending: "hk_st_pending", in_progress: "hk_st_in_progress", done: "hk_st_done" };

function eventText(type: string, detail: Record<string, unknown> | null): string {
  const d = detail ?? {};
  switch (type) {
    case "created":
      return "Task created on check-out";
    case "started":
      return `Cleaning started${d.shift ? ` (${d.shift} shift)` : ""}`;
    case "replaced":
      return `Replaced ${d.qty} × ${d.supply}`;
    case "turned_over":
      return `Turned over${d.to_shift ? ` to ${d.to_shift} shift` : ""}${d.note ? ` — "${d.note}"` : ""}`;
    case "completed":
      return "Room marked ready";
    case "endorsed":
      return "Endorsed to the next team (shift-end cutoff)";
    case "escalated":
      return `Escalated to monitoring${d.reason ? ` — "${d.reason}"` : ""}`;
    default:
      return type;
  }
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireModule("housekeeping");
  const lang = await getLang();
  const canWrite = canWriteModule(user.roleKeys, "housekeeping");
  const detail = await getTaskDetail(id);
  if (!detail) notFound();

  const { task, events } = detail;
  const inspectionPhotos = await listDocPhotos("housekeeping_task", task.id);
  const replacedSupplyNames = events
    .filter((e) => e.event_type === "replaced")
    .map((e) => String((e.detail ?? {}).supply ?? ""))
    .filter(Boolean);
  const [hardStop, shiftEnd, tz] = await Promise.all([isHousekeepingHardStop(), getShiftEndToday(user.userId), getAppTimezone()]);

  return (
    <>
      <div className="mb-4">
        <Link href="/housekeeping" className="text-sm font-medium text-amber-700 hover:underline">
          ← {tt(lang, "hk_title")}
        </Link>
      </div>

      <PageHeader
        title={`${tt(lang, "hk_room")} ${task.unit_number ?? "—"}`}
        subtitle={tt(lang, "hk_cleaning_task")}
        badge={<Badge tone={task.status === "done" ? "green" : "amber"}>{tt(lang, STATUS_KEY[task.status]) || STATUS_LABEL[task.status] || task.status}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <TaskActions
            detail={detail}
            canWrite={canWrite}
            lang={lang}
            replacedSupplyNames={replacedSupplyNames}
            hardStop={hardStop}
            shiftEndIso={shiftEnd}
            photoPanels={
              <>
                <CleaningPhotos taskId={task.id} count={task.photos.length} canWrite={canWrite} />
                <PhotoDocPanel entity="housekeeping_task" entityId={task.id} kind="inspection" title="Inspection photos" label={`Inspection · Room ${task.unit_number ?? ""}`} canWrite={canWrite} canView={canReadModule(user.roleKeys, "media")} photos={inspectionPhotos} />
              </>
            }
          />
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-stone-500">{tt(lang, "hk_activity_log")}</h2>
          <div className="rounded-2xl border border-stone-200 bg-white p-4">
            {events.length === 0 ? (
              <p className="text-sm text-stone-400">{tt(lang, "hk_no_activity")}</p>
            ) : (
              <ul className="space-y-3">
                {events.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 text-sm">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>
                      <span className="text-stone-800">{eventText(e.event_type, e.detail)}</span>
                      <span className="mt-0.5 block text-xs text-stone-400">
                        {e.actor_role ? `${e.actor_role.replace(/_/g, " ")} · ` : ""}
                        {fmtDateTime(e.at, tz)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
