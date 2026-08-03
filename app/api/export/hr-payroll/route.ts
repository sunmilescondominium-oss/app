import { getSessionUser } from "@/lib/auth/dal";
import { canReadModule } from "@/lib/rbac/modules";
import { payrollReport } from "@/lib/hr/queries";
import { toCsv, csvResponse } from "@/lib/export/csv";
import { todayManila } from "@/lib/collections/summary";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || !canReadModule(user.roleKeys, "hr")) return new Response("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const from = url.searchParams.get("from") || todayManila();
  const to = url.searchParams.get("to") || todayManila();
  const report = await payrollReport(from, to);

  const csv = toCsv(
    ["Staff", "Daily rate", "Days", "Half days", "Late (min)", "Undertime (min)", "OT (h)", "Night (h)", "Basic", "OT pay", "Night pay", "Deductions", "Net pay"],
    report.rows.map((r) => [
      r.label, r.dailyRate, r.daysPresent, r.halfDays, r.lateMinutes, r.undertimeMinutes,
      r.otHours, r.nightHours, r.basicPay, r.otPay, r.nightPay, r.deductions, r.netPay,
    ]),
  );
  return csvResponse(`payroll_${from}_to_${to}.csv`, csv);
}
