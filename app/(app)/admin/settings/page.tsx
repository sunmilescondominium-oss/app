import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { getAppSettings } from "@/lib/settings/app-settings";
import { PageHeader } from "@/components/ui";
import { saveAppSetting } from "./actions";

export const metadata = { title: "App Settings" };

// Common IANA timezones for the dropdown
const TIMEZONE_OPTIONS = [
  { value: "Asia/Manila", label: "Asia/Manila (PHT, UTC+8)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT, UTC+8)" },
  { value: "Asia/Hong_Kong", label: "Asia/Hong_Kong (HKT, UTC+8)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (JST, UTC+9)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST, UTC+4)" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST, UTC+5:30)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "America/New_York", label: "America/New_York (EST/EDT)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (PST/PDT)" },
  { value: "UTC", label: "UTC" },
];

export default async function AppSettingsPage() {
  const user = await requireAuth();
  const canWrite = user.allRoleKeys.some((r) => ["admin", "managing_officer", "consultant"].includes(r));
  if (!user.allRoleKeys.some((r) => ["admin", "managing_officer", "accounting", "consultant"].includes(r))) {
    throw new Error("Access denied.");
  }

  const settings = await getAppSettings();

  return (
    <>
      <PageHeader
        title="App Settings"
        subtitle="Global configuration for the system."
        backHref="/admin"
      />

      <div className="space-y-4">
        {settings.map((s) => (
          <div key={s.key} className="rounded-xl border border-stone-200 bg-white p-5">
            <p className="text-sm font-semibold text-stone-800">{s.label}</p>
            {s.description && (
              <p className="mt-0.5 text-xs text-stone-500">{s.description}</p>
            )}
            {canWrite ? (
              <form action={saveAppSetting} className="mt-3 flex flex-wrap items-end gap-3">
                <input type="hidden" name="key" value={s.key} />
                {s.key === "timezone" ? (
                  <select
                    name="value"
                    defaultValue={s.value}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {TIMEZONE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                    {/* If the current value isn't in the list, show it too */}
                    {!TIMEZONE_OPTIONS.some((o) => o.value === s.value) && (
                      <option value={s.value}>{s.value}</option>
                    )}
                  </select>
                ) : (
                  <input
                    name="value"
                    type="text"
                    defaultValue={s.value}
                    className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                )}
                <button
                  type="submit"
                  className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                >
                  Save
                </button>
              </form>
            ) : (
              <p className="mt-2 font-mono text-sm text-stone-700">{s.value}</p>
            )}
            <p className="mt-2 text-[11px] text-stone-400">
              Last updated: {new Date(s.updated_at).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
            </p>
          </div>
        ))}

        {settings.length === 0 && (
          <p className="rounded-xl border border-stone-200 bg-white px-5 py-8 text-center text-sm text-stone-500">
            No settings found. Run migration 0071 to seed the defaults.
          </p>
        )}
      </div>
    </>
  );
}
