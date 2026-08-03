import "server-only";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPayrollSettings } from "@/lib/hr/queries";
import { computeDay, type DayComputation } from "@/lib/hr/payroll";
import type { LeaveRequest } from "@/lib/employees/types";

/** The caller's own payslip for a period (their time records × their rate). */
export async function myPayslip(
  userId: string,
  from: string,
  to: string,
): Promise<{ dailyRate: number; days: DayComputation[]; net: number; basic: number; ot: number; night: number; deductions: number; hours: number }> {
  const admin = createAdminClient();
  const [{ data: pay }, settings, { data: recs }] = await Promise.all([
    admin.from("staff_pay").select("daily_rate").eq("user_id", userId).maybeSingle(),
    getPayrollSettings(),
    admin
      .from("time_records")
      .select("work_date, time_in, time_out")
      .eq("user_id", userId)
      .gte("work_date", from)
      .lte("work_date", to)
      .order("work_date", { ascending: true }),
  ]);
  const dailyRate = Number(pay?.daily_rate ?? 0);
  const days = (recs ?? []).map((r) => computeDay(r as never, settings, dailyRate));
  const r2 = (n: number) => Math.round(n * 100) / 100;
  return {
    dailyRate,
    days,
    net: r2(days.reduce((s, d) => s + d.netPay, 0)),
    basic: r2(days.reduce((s, d) => s + d.basicPay, 0)),
    ot: r2(days.reduce((s, d) => s + d.otPay, 0)),
    night: r2(days.reduce((s, d) => s + d.nightPay, 0)),
    deductions: r2(days.reduce((s, d) => s + d.lateDeduction + d.undertimeDeduction, 0)),
    hours: r2(days.reduce((s, d) => s + d.regularHours + d.otHours, 0)),
  };
}

/** Self-service reads — RLS restricts every row to the calling user. */

export async function myPhotoPath(userId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("photo_path").eq("id", userId).maybeSingle();
  return (data?.photo_path as string | null) ?? null;
}

export async function myLeave(userId: string): Promise<LeaveRequest[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("leave_requests")
    .select("id, user_id, category, leave_type, start_date, end_date, days, hours, reason, status, decided_at, decision_note")
    .eq("user_id", userId)
    .order("start_date", { ascending: false });
  return (data as LeaveRequest[]) ?? [];
}
