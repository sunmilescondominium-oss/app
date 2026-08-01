import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DtrRow, PayrollReport } from "@/lib/hr/types";

/**
 * HR aggregation runs through the SERVICE ROLE: display labels live in
 * `profiles` (self-only under RLS), so HR roles cannot join them via a session
 * client. Access to these functions is gated at the page by requireModule("hr").
 */

async function labelMap(admin: ReturnType<typeof createAdminClient>): Promise<Map<string, string>> {
  const { data } = await admin.from("profiles").select("id, display_label");
  return new Map((data ?? []).map((p) => [p.id as string, (p.display_label as string) || "Staff"]));
}

async function rateMap(admin: ReturnType<typeof createAdminClient>): Promise<Map<string, number>> {
  const { data } = await admin.from("staff_pay").select("user_id, hourly_rate");
  return new Map((data ?? []).map((r) => [r.user_id as string, Number(r.hourly_rate) || 0]));
}

/** DTR totals + payroll (hours × hourly_rate) per staff over a date range. */
export async function payrollReport(from: string, to: string): Promise<PayrollReport> {
  const admin = createAdminClient();
  const [labels, rates, recs] = await Promise.all([
    labelMap(admin),
    rateMap(admin),
    admin
      .from("time_records")
      .select("user_id, work_date, hours")
      .gte("work_date", from)
      .lte("work_date", to)
      .not("time_out", "is", null),
  ]);

  const agg = new Map<string, { hours: number; days: Set<string> }>();
  for (const r of recs.data ?? []) {
    const uid = r.user_id as string;
    const cur = agg.get(uid) ?? { hours: 0, days: new Set<string>() };
    cur.hours += Number(r.hours) || 0;
    cur.days.add(r.work_date as string);
    agg.set(uid, cur);
  }

  const rows: DtrRow[] = [...agg.entries()]
    .map(([userId, a]) => {
      const hours = Math.round(a.hours * 100) / 100;
      const hourlyRate = rates.get(userId) ?? 0;
      return {
        userId,
        label: labels.get(userId) ?? "Staff",
        days: a.days.size,
        hours,
        hourlyRate,
        gross: Math.round(hours * hourlyRate * 100) / 100,
      };
    })
    .sort((x, y) => x.label.localeCompare(y.label));

  return {
    from,
    to,
    rows,
    hoursTotal: Math.round(rows.reduce((s, r) => s + r.hours, 0) * 100) / 100,
    grossTotal: Math.round(rows.reduce((s, r) => s + r.gross, 0) * 100) / 100,
  };
}

/** Every staff profile with its current hourly rate (for the rate editor). */
export async function staffPayList(): Promise<{ userId: string; label: string; hourlyRate: number }[]> {
  const admin = createAdminClient();
  const [labels, rates] = await Promise.all([labelMap(admin), rateMap(admin)]);
  return [...labels.entries()]
    .map(([userId, label]) => ({ userId, label, hourlyRate: rates.get(userId) ?? 0 }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
