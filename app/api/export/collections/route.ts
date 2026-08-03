import { getSessionUser } from "@/lib/auth/dal";
import { canReadModule } from "@/lib/rbac/modules";
import { listCollections } from "@/lib/collections/queries";
import { toCsv, csvResponse } from "@/lib/export/csv";
import { todayManila } from "@/lib/collections/summary";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || !canReadModule(user.roleKeys, "collections")) return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const date = url.searchParams.get("date") || todayManila();
  const rows = await listCollections(date);

  const csv = toCsv(
    ["Date", "Business line", "Unit", "Property", "Amount", "OR #", "Payment type", "Collected by (role)", "Remarks"],
    rows.map((r) => [
      r.collected_on, r.business_line, r.unit?.unit_number ?? "", r.unit?.property_name ?? "",
      r.amount, r.or_number ?? "", r.payment_type, r.collected_by_role ?? "", r.remarks ?? "",
    ]),
  );
  return csvResponse(`collections_${date}.csv`, csv);
}
