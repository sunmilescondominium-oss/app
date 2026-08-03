import { LeaveDecision } from "./leave-decision";
import { LeaveConflictFlags } from "./leave-conflict";
import type { LeaveRequest } from "@/lib/employees/types";
import type { LeaveConflict } from "@/lib/employees/leave-analysis";

export function PendingLeave({
  items,
  canDecide,
}: {
  items: { req: LeaveRequest; conflict: LeaveConflict | null }[];
  canDecide: boolean;
}) {
  if (items.length === 0) return <p className="text-sm text-stone-500">No pending requests.</p>;
  return (
    <div className="space-y-3">
      {items.map(({ req, conflict }) => (
        <div key={req.id} className="rounded-2xl border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-medium text-stone-800">
                {req.label} · <span className="text-stone-500">{req.leave_type}</span>
              </p>
              <p className="text-sm text-stone-500">
                {req.hours != null ? `${req.start_date} · ${req.hours}h` : `${req.start_date} → ${req.end_date} (${req.days}d)`}
                {req.reason ? ` · ${req.reason}` : ""}
              </p>
            </div>
            {canDecide && <LeaveDecision id={req.id} />}
          </div>
          {conflict && (
            <div className="mt-2">
              <LeaveConflictFlags c={conflict} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
