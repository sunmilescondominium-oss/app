import { requireAuth } from "@/lib/auth/dal";
import { listFeatureFlags, getAllFlagHistory } from "@/lib/settings/flags";
import { PageHeader } from "@/components/ui";
import { FlagToggle } from "./flag-toggle";

export const metadata = { title: "Feature Flags" };

function fmt(iso: string) {
  return new Date(iso).toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "short", timeStyle: "short" });
}

export default async function FeatureFlagsPage() {
  const user = await requireAuth();
  const isSuper = user.allRoleKeys.some((r) =>
    ["admin", "managing_officer", "consultant"].includes(r),
  );
  if (!isSuper) throw new Error("Access denied.");
  const canWrite = isSuper;

  const [flags, history] = await Promise.all([listFeatureFlags(), getAllFlagHistory()]);

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
        {flags.map((f) => {
          const flagHistory = history[f.key] ?? [];
          return (
            <div
              key={f.key}
              className="rounded-xl border border-stone-200 bg-white px-5 py-4"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-stone-800">{f.label}</p>
                  <p className="text-xs text-stone-400 font-mono">{f.key}</p>
                  {f.updated_at && (
                    <p className="mt-0.5 text-[11px] text-stone-400">
                      Last changed {fmt(f.updated_at)}
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

              {/* Change history */}
              {flagHistory.length > 0 && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-[11px] text-amber-600 hover:underline select-none">
                    History ({flagHistory.length})
                  </summary>
                  <div className="mt-2 rounded-lg border border-stone-100 bg-stone-50 divide-y divide-stone-100 overflow-hidden">
                    {flagHistory.map((h) => (
                      <div key={h.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${h.old_enabled ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                          {h.old_enabled ? "On" : "Off"}
                        </span>
                        <span className="text-stone-400">→</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${h.new_enabled ? "bg-emerald-100 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
                          {h.new_enabled ? "On" : "Off"}
                        </span>
                        <span className="text-stone-400 ml-1">{fmt(h.changed_at)}</span>
                        {h.changed_by_role && (
                          <span className="text-stone-400">· {h.changed_by_role}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
