import { requireModule } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { PageHeader, Breadcrumb } from "@/components/ui";
import { ManualEntryForm } from "./ManualEntryForm";

export const metadata = { title: "Manual Hotel AR Entry" };

const SUPERVISOR_ROLES = ["hotel_rental_monitoring", "admin", "managing_officer", "consultant", "accounting"];

export default async function ManualHotelEntryPage() {
  const user = await requireModule("hotel");
  if (!user.roleKeys.some((r) => SUPERVISOR_ROLES.includes(r))) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        You do not have permission to record manual hotel entries.
      </div>
    );
  }

  const admin = createAdminClient();
  const { data: units } = await admin
    .from("units")
    .select("id, unit_number, unit_type")
    .eq("business_line", "hotel")
    .eq("is_active", true)
    .order("unit_number");

  const roomOptions = (units ?? []).map((u: Record<string, unknown>) => ({
    id: u.id as string,
    label: u.unit_type ? `${u.unit_number} (${u.unit_type})` : (u.unit_number as string),
  }));

  return (
    <>
      <Breadcrumb
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Hotel Ops", href: "/hotel" },
          { label: "Manual AR Entry" },
        ]}
      />
      <PageHeader
        title="Manual Hotel AR Entry"
        subtitle="Enter backdate room collections from manual records during offline/outage periods."
      />

      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>For reconciliation use only.</strong> Use this form to record hotel stays and collections that were manually captured while the system was offline. Each entry creates a completed stay record and posts to the collection register so it can be included in transmittals.
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-6 max-w-lg">
        <ManualEntryForm rooms={roomOptions} />
      </div>
    </>
  );
}
