import { getSessionUser } from "@/lib/auth/dal";
import { canReadModule } from "@/lib/rbac/modules";
import { staffPerformance } from "@/lib/hr/performance";
import { toCsv, csvResponse } from "@/lib/export/csv";
import { todayManila } from "@/lib/collections/summary";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || !canReadModule(user.roleKeys, "hr")) return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const from = url.searchParams.get("from") || todayManila();
  const to = url.searchParams.get("to") || todayManila();
  const rows = await staffPerformance(from, to);

  const csv = toCsv(
    ["Staff", "Role(s)", "Days worked", "Half days", "Late days", "OT hours", "Activity"],
    rows.map((r) => [r.label, r.roles.join("; "), r.daysPresent, r.halfDays, r.lateDays, r.otHours, r.activity]),
  );
  return csvResponse(`staff-performance_${from}_to_${to}.csv`, csv);
}
