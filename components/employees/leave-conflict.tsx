import type { LeaveConflict } from "@/lib/employees/leave-analysis";

/** Renders the coverage / task-impact flags for a pending leave request. */
export function LeaveConflictFlags({ c }: { c: LeaveConflict }) {
  const chips: { text: string; tone: "red" | "amber" | "green" }[] = [];

  chips.push(
    c.leadOk
      ? { text: `${c.leadDays}d notice`, tone: "green" }
      : { text: `Short notice (${c.leadDays}d)`, tone: "amber" },
  );
  for (const r of c.soleRoles) chips.push({ text: `Only staff: ${r.label}`, tone: "red" });
  for (const r of c.uncoveredRoles) chips.push({ text: `Nobody scheduled: ${r.label}`, tone: "red" });
  if (c.openRepairs > 0) chips.push({ text: `${c.openRepairs} open repair${c.openRepairs > 1 ? "s" : ""}`, tone: "amber" });
  if (c.openHousekeeping > 0)
    chips.push({ text: `${c.openHousekeeping} cleaning task${c.openHousekeeping > 1 ? "s" : ""}`, tone: "amber" });
  if (c.noScheduleData) chips.push({ text: "No shifts set for these dates", tone: "amber" });
  if (!c.hasConcern) chips.push({ text: "Coverage OK", tone: "green" });

  const tones: Record<string, string> = {
    red: "bg-rose-100 text-rose-700",
    amber: "bg-amber-100 text-amber-800",
    green: "bg-emerald-100 text-emerald-700",
  };

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip, i) => (
        <span key={i} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tones[chip.tone]}`}>
          {chip.text}
        </span>
      ))}
      {c.coverage.length > 0 && (
        <span className="text-[11px] text-stone-400">
          coverage: {c.coverage.map((r) => `${r.label} ${r.scheduled}/${r.others} scheduled`).join(", ")}
        </span>
      )}
    </div>
  );
}
