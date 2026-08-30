import { requireAuth } from "@/lib/auth/dal";
import { getAppSettings, getAllSettingHistory } from "@/lib/settings/app-settings";
import { PageHeader } from "@/components/ui";
import { SettingCard } from "./setting-card";

export const metadata = { title: "App Settings" };

export default async function AppSettingsPage() {
  const user = await requireAuth();
  const canWrite = user.allRoleKeys.some((r) =>
    ["admin", "managing_officer", "consultant"].includes(r),
  );
  if (
    !user.allRoleKeys.some((r) =>
      ["admin", "managing_officer", "accounting", "consultant"].includes(r),
    )
  ) {
    throw new Error("Access denied.");
  }

  const [settings, history] = await Promise.all([
    getAppSettings(),
    getAllSettingHistory(),
  ]);

  return (
    <>
      <PageHeader
        title="App Settings"
        subtitle="Global configuration for the system."
        backHref="/admin"
      />

      <div className="space-y-4">
        {settings.map((s) => (
          <SettingCard
            key={s.key}
            setting={s}
            history={history[s.key] ?? []}
            canWrite={canWrite}
          />
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
