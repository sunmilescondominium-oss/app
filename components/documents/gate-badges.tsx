import type { GateStatus } from "@/lib/documents/gates";

export function GateBadges({ gates }: { gates: GateStatus[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {gates.map((g) => {
        const cls =
          g.total === 0
            ? "bg-stone-100 text-stone-400"
            : g.complete
              ? "bg-emerald-100 text-emerald-800"
              : "bg-amber-100 text-amber-800";
        return (
          <span
            key={g.key}
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}
            title={`${g.done}/${g.total} documents`}
          >
            {g.label}
            {g.total > 0 ? ` ${g.done}/${g.total}` : ""}
          </span>
        );
      })}
    </div>
  );
}
