import { getSessionUser } from "@/lib/auth/dal";
import { canReadModule } from "@/lib/rbac/modules";
import { listTransmittals } from "@/lib/collections/queries";
import { toCsv, csvResponse } from "@/lib/export/csv";

export async function GET() {
  const user = await getSessionUser();
  if (!user || !canReadModule(user.roleKeys, "transmittals")) return new Response("Forbidden", { status: 403 });

  const rows = await listTransmittals(200);
  const csv = toCsv(
    ["Ref", "Date", "Business line", "Total", "Counted cash", "Deposited", "Status", "Custody stage", "Deposit slip"],
    rows.map((t) => [
      t.id.slice(0, 8).toUpperCase(), t.transmittal_date, t.business_line ?? "combined",
      t.total_amount, t.counted_cash ?? "", t.deposited_amount ?? "", t.status, t.custody_stage, t.deposit_slip_ref ?? "",
    ]),
  );
  return csvResponse(`transmittals.csv`, csv);
}
