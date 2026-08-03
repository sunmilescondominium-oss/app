import Link from "next/link";
import { notFound } from "next/navigation";
import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { getTaskDetail } from "@/lib/housekeeping/queries";
import { HOUSEKEEPING_STATUSES } from "@/lib/config";
import { PageHeader, Badge } from "@/components/ui";
import { TaskActions } from "@/components/housekeeping/task-actions";
import { CleaningPhotos } from "@/components/housekeeping/cleaning-photos";

export const metadata = { title: "Housekeeping task" };

const STATUS_LABEL = Object.fromEntries(HOUSEKEEPING_STATUSES.map((s) => [s.key, s.label]));

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
  const canWrite = canWriteModule(user.roleKeys, "housekeeping");
  const detail = await getTaskDetail(id);
  if (!detail) notFound();

  const { task, events } = detail;

  return (
    <>
      <div className="mb-4">
        <Link href="/housekeeping" className="text-sm font-medium text-amber-700 hover:underline">
          ← Housekeeping
        </Link>
      </div>

      <PageHeader
        title={`Room ${task.unit_number ?? "—"}`}
        subtitle="Cleaning task"
        badge={<Badge tone={task.status === "done" ? "green" : "amber"}>{STATUS_LABEL[task.status] ?? task.status}</Badge>}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <TaskActions detail={detail} canWrite={canWrite} />
          <CleaningPhotos taskId={task.id} count={task.photos.length} canWrite={canWrite} />
        </div>

        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">Activity log</h2>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            {events.length === 0 ? (
              <p className="text-sm text-slate-400">No activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {events.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 text-sm">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    <span>
                      <span className="text-slate-800">{eventText(e.event_type, e.detail)}</span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        {e.actor_role ? `${e.actor_role.replace(/_/g, " ")} · ` : ""}
                        {new Date(e.at).toLocaleString()}
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
