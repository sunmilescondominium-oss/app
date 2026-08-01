import { MODULES, canWriteModule, type ModuleKey } from "@/lib/rbac/modules";
import { Card, Badge, PageHeader } from "@/components/ui";

/**
 * Milestone placeholder for a module whose foundation (routing + RBAC) is live
 * but whose features arrive in a later milestone. Keeps the app coherent while
 * making the roadmap explicit, per the brief's "clearly-labeled placeholder".
 */
const PLANNED: Partial<Record<ModuleKey, string[]>> = {
  inventory: [
    "Unified registry for condo, rental, hotel & Airbnb units",
    "Add / edit / deactivate / recategorize any unit — no code change",
    "CSV bulk import: 114 condo units + H01–H18 + hotel rooms",
    "Per-unit status: available, occupied, reserved, maintenance, blocked",
  ],
  collections: [
    "Daily collections entry by business line and unit",
    "Digital cash transmittal (dual hotel + rental counts), printable",
    "Role-scoped views: monitoring enters, accounting confirms",
    "6:00 PM alert when a daily summary is missing",
  ],
  buyers: [
    "Buyer accounts linked to a unit, with payment scheme",
    "Amortization SOA + penalty (Civil Code Art. 1253), versioned",
    "OR / PR / AR payment history and account status",
    "Public PIN portal for buyers to self-check their balance",
  ],
  documents: [
    "Full document-type catalog per condo buyer",
    "Per-document status with scanned upload to a private bucket",
    "Milestone alerts: reservation → CTS → loan → title transfer",
  ],
  disputes: [
    "Case log per unit with status, last action and next action",
    "Historical case library seeded as institutional reference",
    "Lawyer-coordination notes visible to the consultant role",
  ],
  owner: [
    "Simplified weekly overview: collections, occupancy, open issues",
    "Large-text, jargon-free, high-contrast design for the Owner",
    "Print-to-PDF to hand the Owner a physical copy",
  ],
};

export function ComingSoon({
  moduleKey,
  roleKeys,
}: {
  moduleKey: ModuleKey;
  roleKeys: string[];
}) {
  const m = MODULES[moduleKey];
  const canWrite = canWriteModule(roleKeys, moduleKey);

  return (
    <>
      <PageHeader
        title={m.label}
        subtitle={m.blurb}
        badge={<Badge tone="amber">Arrives in {m.milestone}</Badge>}
      />
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="green">You can view</Badge>
          {canWrite ? (
            <Badge tone="brand">You can edit</Badge>
          ) : (
            <Badge tone="slate">View only</Badge>
          )}
        </div>

        <h2 className="mt-5 text-sm font-semibold uppercase tracking-wide text-slate-500">
          What&apos;s coming
        </h2>
        <ul className="mt-3 space-y-2">
          {(PLANNED[moduleKey] ?? []).map((item) => (
            <li key={item} className="flex gap-2 text-sm text-slate-700">
              <span
                aria-hidden
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
              />
              <span>{item}</span>
            </li>
          ))}
        </ul>

        <p className="mt-6 rounded-lg bg-slate-50 px-4 py-3 text-xs text-slate-500">
          Foundation is live — this screen is gated to the correct role(s) and is
          ready to be built out in milestone {m.milestone}.
        </p>
      </Card>
    </>
  );
}
