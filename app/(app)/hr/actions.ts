"use server";

import { revalidatePath } from "next/cache";
import { requireModule, requireModuleWrite, userHasAnyRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import type { PayrollSettings } from "@/lib/hr/payroll";
import type { DtrImportResult } from "@/lib/imports/dtr";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Roles allowed to upload a DTR sheet (timekeeper prepares/uploads). */
const DTR_IMPORT_ROLES = ["warehouse_timekeeper", "accounting", "admin"];
/** Roles allowed to OVERWRITE an existing punch that differs (discrepancy). */
const DTR_OVERWRITE_ROLES = ["accounting", "admin"];

/** Manila HH:MM for a stored timestamp (for comparing to imported times). */
function manilaHM(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
}

/**
 * Bulk-upload DTR rows into time_records. New dates import directly; a date that
 * already has a DIFFERENT system record is flagged as a discrepancy and only
 * applied when accounting/admin re-run with overwrite + the confirm word.
 */
export async function bulkImportDtr(
  rows: Record<string, string>[],
  opts: { overwrite?: boolean; confirm?: string } = {},
): Promise<DtrImportResult> {
  const user = await requireModule("hr");
  if (!userHasAnyRole(user, DTR_IMPORT_ROLES)) return { ok: false, error: "Your role can't upload a DTR." };
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "No rows to import." };
  if (rows.length > 10000) return { ok: false, error: "Too many rows (max 10000)." };

  const canOverwrite = userHasAnyRole(user, DTR_OVERWRITE_ROLES);
  const applyOverwrite = Boolean(opts.overwrite) && canOverwrite && (opts.confirm ?? "").trim().toUpperCase() === "OVERWRITE";

  const admin = createAdminClient();
  const userIdCache = new Map<string, string | null>();
  const invalid: { row: number; error: string }[] = [];
  const conflicts: { row: number; error: string }[] = [];
  let inserted = 0, overwritten = 0, unchanged = 0;

  const reDate = /^\d{4}-\d{2}-\d{2}$/;
  const reTime = /^\d{2}:\d{2}$/;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 2;
    const empNo = (r.employee_no ?? "").trim();
    const date = (r.date ?? "").trim();
    const tin = (r.time_in ?? "").trim();
    const tout = (r.time_out ?? "").trim();

    if (!empNo) { invalid.push({ row: line, error: "employee_no is required" }); continue; }
    if (!reDate.test(date)) { invalid.push({ row: line, error: "date must be YYYY-MM-DD" }); continue; }
    if (!reTime.test(tin)) { invalid.push({ row: line, error: "time_in must be HH:MM" }); continue; }
    if (tout && !reTime.test(tout)) { invalid.push({ row: line, error: "time_out must be HH:MM or blank" }); continue; }

    if (!userIdCache.has(empNo)) {
      const { data } = await admin.from("profiles").select("id, is_active").eq("employee_no", empNo).maybeSingle();
      userIdCache.set(empNo, data && data.is_active ? (data.id as string) : null);
    }
    const uid = userIdCache.get(empNo);
    if (!uid) { invalid.push({ row: line, error: `employee "${empNo}" not found / inactive` }); continue; }

    const time_in = `${date}T${tin}:00+08:00`;
    const time_out = tout ? `${date}T${tout}:00+08:00` : null;
    const hours = time_out ? Math.round(((new Date(time_out).getTime() - new Date(time_in).getTime()) / 3_600_000) * 100) / 100 : null;

    const { data: existing } = await admin
      .from("time_records")
      .select("id, time_in, time_out")
      .eq("user_id", uid)
      .eq("work_date", date)
      .order("time_in", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!existing) {
      await admin.from("time_records").insert({ user_id: uid, work_date: date, time_in, time_out, hours, source: "import", note: "DTR import" });
      inserted += 1;
      continue;
    }

    const sameIn = manilaHM(existing.time_in as string | null) === tin;
    const sameOut = manilaHM(existing.time_out as string | null) === tout;
    if (sameIn && sameOut) { unchanged += 1; continue; }

    // Discrepancy: existing system record differs from the uploaded row.
    if (!applyOverwrite) {
      conflicts.push({ row: line, error: `${empNo} ${date}: differs from system record (${manilaHM(existing.time_in as string) || "—"}–${manilaHM(existing.time_out as string) || "—"} vs ${tin}–${tout || "—"})` });
      continue;
    }
    await admin.from("time_records").update({ time_in, time_out, hours, source: "import", note: "DTR import (overwrite)", updated_at: new Date().toISOString() }).eq("id", existing.id);
    await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "update", entity: "time_records", entityId: existing.id as string, diff: { dtr_overwrite: true, empNo, date, from: `${manilaHM(existing.time_in as string)}-${manilaHM(existing.time_out as string)}`, to: `${tin}-${tout}` } });
    overwritten += 1;
  }

  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "create", entity: "time_records", entityId: null, diff: { dtr_import: true, inserted, overwritten, unchanged, conflicts: conflicts.length, invalid: invalid.length } });
  revalidatePath("/hr");
  return { ok: true, inserted, overwritten, unchanged, conflicts, invalid, needsOverwrite: conflicts.length > 0, canOverwrite };
}

/** Set a staff member's DAILY rate (accounting / admin). */
export async function setStaffPay(userId: string, dailyRate: number): Promise<ActionResult> {
  const user = await requireModuleWrite("hr");
  if (!userId) return { ok: false, error: "Missing staff." };
  if (!Number.isFinite(dailyRate) || dailyRate < 0) return { ok: false, error: "Enter a valid daily rate." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_pay")
    .upsert({ user_id: userId, daily_rate: dailyRate, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "staff_pay",
    entityId: userId,
    diff: { daily_rate: dailyRate },
  });
  revalidatePath("/hr");
  return { ok: true };
}

/** Mark a staff member as fixed-salary (no DTR) or back to DTR-based pay. */
export async function setDtrExempt(userId: string, exempt: boolean): Promise<ActionResult> {
  const user = await requireModuleWrite("hr");
  if (!userId) return { ok: false, error: "Missing staff." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("staff_pay")
    .upsert({ user_id: userId, dtr_exempt: exempt, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "staff_pay",
    entityId: userId,
    diff: { dtr_exempt: exempt },
  });
  revalidatePath("/hr");
  return { ok: true };
}

/** Update the org-wide payroll schedule / premium settings (accounting / admin). */
export async function setPayrollSettings(input: PayrollSettings): Promise<ActionResult> {
  const user = await requireModuleWrite("hr");

  const n = (v: number, lo: number, hi: number) => Number.isFinite(v) && v >= lo && v <= hi;
  if (!n(input.standard_hours, 1, 24)) return { ok: false, error: "Standard hours must be 1–24." };
  if (!n(input.break_hours, 0, 8)) return { ok: false, error: "Break hours must be 0–8." };
  if (!n(input.grace_minutes, 0, 120)) return { ok: false, error: "Grace minutes must be 0–120." };
  if (!n(input.ot_multiplier, 1, 5)) return { ok: false, error: "OT multiplier must be 1–5." };
  if (!n(input.night_diff_rate, 0, 1)) return { ok: false, error: "Night diff rate must be 0–1." };
  if (!n(input.half_day_hours, 0, 24)) return { ok: false, error: "Half-day hours must be 0–24." };
  if (!n(input.late_round_up_minutes, 0, 60)) return { ok: false, error: "Late round-up must be 0–60." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("payroll_settings")
    .update({
      scheduled_time_in: input.scheduled_time_in,
      standard_hours: input.standard_hours,
      break_hours: input.break_hours,
      grace_minutes: input.grace_minutes,
      ot_multiplier: input.ot_multiplier,
      night_diff_rate: input.night_diff_rate,
      night_start: input.night_start,
      night_end: input.night_end,
      half_day_hours: input.half_day_hours,
      late_round_up_minutes: input.late_round_up_minutes,
      auto_checkout_time: input.auto_checkout_time,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "payroll_settings",
    entityId: "1",
    diff: { ...input },
  });
  revalidatePath("/hr");
  return { ok: true };
}
