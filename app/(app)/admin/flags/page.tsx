import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { listFeatureFlags } from "@/lib/settings/flags";
import { PageHeader } from "@/components/ui";
import { FlagToggle } from "./flag-toggle";

export const metadata = { title: "Feature Flags" };

export default async function FeatureFlagsPage() {
  const user = await requireAuth();
  const isSuper = user.allRoleKeys.some((r) => ["admin", "managing_officer", "consultant"].includes(r));
  if (!isSuper) throw new Error("Access denied.");
  const canWrite = isSuper;
  const flags = await listFeatureFlags();

  return (
    <>
      <PageHeader
        title="Feature Flags"
        subtitle="Enable or disable optional features without deploying code."
        backHref="/admin"
      />

      <div className="mt-4 space-y-3">
        {flags.length === 0 && (
          <p className="rounded-xl border border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500">
            No feature flags found in the database.
          </p>
        )}
        {flags.map((f) => (
          <div
            key={f.key}
            className="flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white px-5 py-4"
          >
            <div>
              <p className="font-medium text-stone-800">{f.label}</p>
              <p className="text-xs text-stone-400 font-mono">{f.key}</p>
              {f.updated_at && (
                <p className="mt-0.5 text-[11px] text-stone-400">
                  Last updated {new Date(f.updated_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
                  {f.updated_by_role ? ` by ${f.updated_by_role}` : ""}
                </p>
              )}
            </div>
            {canWrite ? (
              <FlagToggle flagKey={f.key} enabled={f.enabled} />
            ) : (
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${f.enabled ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                {f.enabled ? "On" : "Off"}
              </span>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
