import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { listIncidents } from "@/lib/incidents/queries";
import { PageHeader, Badge } from "@/components/ui";
import { HelpPanel } from "@/components/guide/help";
import { IncidentForm, ResolveToggle } from "@/components/incidents/incident-form";
import { PhotoDocPanel } from "@/components/capture/photo-doc-panel";

export const metadata = { title: "Incident Reports" };

const CAT_TONE: Record<string, "rose" | "amber" | "indigo" | "slate"> = {
  security: "rose", safety: "amber", damage: "indigo", other: "slate",
};

export default async function IncidentsPage() {
  const user = await requireModule("incidents");
  const canWrite = canWriteModule(user.roleKeys, "incidents");
  const incidents = await listIncidents();
  const open = incidents.filter((i) => i.status === "open").length;

  return (
    <>
      <PageHeader
        backHref="/dashboard"
        title="Incident Reports"
        subtitle="Security, safety & damage — with live, timestamped photo evidence."
        badge={<Badge tone={open > 0 ? "amber" : "green"}>{open} open</Badge>}
      />

      <HelpPanel
        title="How to report an incident"
        steps={[
          "Fill in the title, category and where it happened, then log it.",
          "On the new incident's card below, take live photos (and note anything relevant) — they're stamped with the exact time.",
          "A supervisor marks it resolved once handled.",
        ]}
      />

      {canWrite && <IncidentForm />}

      <div className="space-y-4">
        {incidents.length === 0 && <p className="text-sm text-stone-500">No incidents reported.</p>}
        {incidents.map((i) => (
          <div key={i.id} className="rounded-2xl border border-stone-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Badge tone={CAT_TONE[i.category] ?? "slate"}>{i.category}</Badge>
                  <span className={`text-xs font-semibold ${i.status === "open" ? "text-amber-700" : "text-emerald-700"}`}>{i.status}</span>
                </div>
                <p className="mt-1 font-semibold text-stone-900">{i.title}</p>
                <p className="text-xs text-stone-500">
                  {i.location ? `${i.location} · ` : ""}{new Date(i.created_at).toLocaleString("en-PH", { timeZone: "Asia/Manila", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {i.reported_by_role ? ` · ${i.reported_by_role.replace(/_/g, " ")}` : ""}
                </p>
                {i.description && <p className="mt-1 text-sm text-stone-600">{i.description}</p>}
              </div>
              {canWrite && <ResolveToggle id={i.id} resolved={i.status === "resolved"} />}
            </div>
            <div className="mt-3">
              <PhotoDocPanel
                entity="incident"
                entityId={i.id}
                kind="incident"
                title="Photo evidence"
                label={`Incident · ${i.category}`}
                canWrite={canWrite}
                photos={i.photos}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
