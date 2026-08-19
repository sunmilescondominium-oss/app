import Link from "next/link";
import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { PageHeader } from "@/components/ui";
import { listARRegister } from "@/lib/hotel/ar-register";
import { ARRegisterTable } from "./ar-register-table";
import { todayManila } from "@/lib/collections/summary";

export const dynamic = "force-dynamic";
export const metadata = { title: "AR/OR Register" };

const ALLOWED = ["hotel_rental_monitoring", "admin", "managing_officer", "consultant", "accounting", "hotel_cashier"] as const;
const CAN_EDIT = ["admin", "managing_officer", "accounting", "consultant"] as const;

export default async function ARRegisterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...ALLOWED]))
    return <p className="p-8 text-sm text-stone-500">Access denied.</p>;

  const sp = await searchParams;
  const date = (typeof sp.date === "string" && sp.date) || todayManila();
  const canEdit = userHasAnyRole(user, [...CAN_EDIT]);

  const entries = await listARRegister(date);

  return (
    <>
      <PageHeader
        backHref="/hotel"
        title="AR / OR Register"
        subtitle="Hotel payments with Acknowledgment Receipt and Official Receipt tracking."
      />

      {/* Date picker */}
      <form method="GET" className="mb-5 flex items-center gap-3">
        <label className="text-sm font-medium text-stone-600">Date</label>
        <input
          type="date"
          name="date"
          defaultValue={date}
          className="rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
        />
        <button
          type="submit"
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
        >
          View
        </button>
        <Link href="/hotel/shifts" className="ml-auto text-sm font-medium text-amber-700 hover:underline">
          Cashier shifts →
        </Link>
      </form>

      {canEdit && (
        <p className="mb-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
          As accounting, you may correct AR/OR assignments by clicking <strong>Edit</strong> on any row. All changes are logged for audit.
        </p>
      )}

      <div className="rounded-xl border border-stone-200 bg-white p-4">
        <ARRegisterTable entries={entries} canEdit={canEdit} />
      </div>
    </>
  );
}
