import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeDay, DEFAULT_PAYROLL_SETTINGS, type DayComputation, type PayrollSettings } from "@/lib/hr/payroll";
import type { DtrRow, PayrollReport } from "@/lib/hr/types";

/**
 * HR aggregation runs through the SERVICE ROLE: display labels live in
 * `profiles` (self-only under RLS), so HR roles cannot join them via a session
 * client. Access is gated at the page by requireModule("hr").
 */

type Admin = ReturnType<typeof createAdminClient>;

async function labelMap(admin: Admin): Promise<Map<string, string>> {
  const { data } = await admin.from("profiles").select("id, display_label, full_name");
  return new Map((data ?? []).map((p) => [p.id as string, (p.full_name as string) || (p.display_label as string) || "Staff"]));
}

async function rateMap(admin: Admin): Promise<Map<string, number>> {
  const { data } = await admin.from("staff_pay").select("user_id, daily_rate");
  return new Map((data ?? []).map((r) => [r.user_id as string, Number(r.daily_rate) || 0]));
}

export async function getPayrollSettings(): Promise<PayrollSettings> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("payroll_settings")
    .select("scheduled_time_in, standard_hours, break_hours, grace_minutes, ot_multiplier, night_diff_rate, night_start, night_end, half_day_hours, late_round_up_minutes, auto_checkout_time")
    .eq("id", 1)
    .maybeSingle();
  if (!data) return DEFAULT_PAYROLL_SETTINGS;
  return {
    scheduled_time_in: data.scheduled_time_in as string,
    standard_hours: Number(data.standard_hours),
    break_hours: Number(data.break_hours),
    grace_minutes: Number(data.grace_minutes),
    ot_multiplier: Number(data.ot_multiplier),
    night_diff_rate: Number(data.night_diff_rate),
    night_start: data.night_start as string,
    night_end: data.night_end as string,
    half_day_hours: Number(data.half_day_hours),
    late_round_up_minutes: Number(data.late_round_up_minutes ?? 30),
    auto_checkout_time: (data.auto_checkout_time as string) ?? "17:00",
  };
}

function emptyRow(userId: string, label: string, dailyRate: number): DtrRow {
  return {
    userId,
    label,
    dailyRate,
    daysPresent: 0,
    halfDays: 0,
    lateDays: 0,
    lateMinutes: 0,
    undertimeMinutes: 0,
    regularHours: 0,
    otHours: 0,
    nightHours: 0,
    basicPay: 0,
    otPay: 0,
    nightPay: 0,
    deductions: 0,
    netPay: 0,
  };
}

function accumulate(row: DtrRow, d: DayComputation): void {
  if (d.status === "present") row.daysPresent += 1;
  if (d.status === "half_day") row.halfDays += 1;
  if (d.lateMinutes > 0) row.lateDays += 1;
  row.lateMinutes += d.lateMinutes;
  row.undertimeMinutes += d.undertimeMinutes;
  row.regularHours += d.regularHours;
  row.otHours += d.otHours;
  row.nightHours += d.nightHours;
  row.basicPay += d.basicPay;
  row.otPay += d.otPay;
  row.nightPay += d.nightPay;
  row.deductions += d.lateDeduction + d.undertimeDeduction;
  row.netPay += d.netPay;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Payroll totals per staff over a date range, Labor-Code itemized. */
export async function payrollReport(from: string, to: string): Promise<PayrollReport> {
  const admin = createAdminClient();
  const [labels, rates, settings, recs] = await Promise.all([
    labelMap(admin),
    rateMap(admin),
    getPayrollSettings(),
    admin
      .from("time_records")
      .select("user_id, work_date, time_in, time_out")
      .gte("work_date", from)
      .lte("work_date", to)
      .not("time_out", "is", null),
  ]);

  const byUser = new Map<string, DtrRow>();
  for (const r of recs.data ?? []) {
    const uid = r.user_id as string;
    const row = byUser.get(uid) ?? emptyRow(uid, labels.get(uid) ?? "Staff", rates.get(uid) ?? 0);
    accumulate(row, computeDay(r as never, settings, row.dailyRate));
    byUser.set(uid, row);
  }

  const rows = [...byUser.values()]
    .map((r) => ({
      ...r,
      regularHours: round(r.regularHours),
      otHours: round(r.otHours),
      nightHours: round(r.nightHours),
      basicPay: round(r.basicPay),
      otPay: round(r.otPay),
      nightPay: round(r.nightPay),
      deductions: round(r.deductions),
      netPay: round(r.netPay),
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return {
    from,
    to,
    rows,
    netTotal: round(rows.reduce((s, r) => s + r.netPay, 0)),
    basicTotal: round(rows.reduce((s, r) => s + r.basicPay, 0)),
    otTotal: round(rows.reduce((s, r) => s + r.otPay, 0)),
    nightTotal: round(rows.reduce((s, r) => s + r.nightPay, 0)),
    deductionTotal: round(rows.reduce((s, r) => s + r.deductions, 0)),
  };
}

/** Per-day DTR breakdown for one staff member (payslip detail). */
export async function dtrDetail(
  userId: string,
  from: string,
  to: string,
): Promise<{ label: string; dailyRate: number; days: DayComputation[] }> {
  const admin = createAdminClient();
  const [labels, rates, settings, recs] = await Promise.all([
    labelMap(admin),
    rateMap(admin),
    getPayrollSettings(),
    admin
      .from("time_records")
      .select("user_id, work_date, time_in, time_out")
      .eq("user_id", userId)
      .gte("work_date", from)
      .lte("work_date", to)
      .order("work_date", { ascending: true }),
  ]);
  const dailyRate = rates.get(userId) ?? 0;
  const days = (recs.data ?? []).map((r) => computeDay(r as never, settings, dailyRate));
  return { label: labels.get(userId) ?? "Staff", dailyRate, days };
}

/** Every staff profile with its current daily rate (for the rate editor). */
export async function staffPayList(): Promise<{ userId: string; label: string; dailyRate: number }[]> {
  const admin = createAdminClient();
  const [labels, rates] = await Promise.all([labelMap(admin), rateMap(admin)]);
  return [...labels.entries()]
    .map(([userId, label]) => ({ userId, label, dailyRate: rates.get(userId) ?? 0 }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
