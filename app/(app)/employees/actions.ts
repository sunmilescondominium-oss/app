"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite, requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { LEAVE_APPROVER_ROLES } from "@/lib/rbac/modules";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts/sendAlert";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Upload a staff photo (HR / admin / consultant / ops / top users). */
export async function uploadStaffPhoto(userId: string, formData: FormData): Promise<ActionResult> {
  const user = await requireModuleWrite("employees");
  const photo = formData.get("photo");
  if (!(photo instanceof File) || photo.size === 0) return { ok: false, error: "Choose a photo." };
  if (!photo.type.startsWith("image/")) return { ok: false, error: "File must be an image." };
  if (photo.size > 8 * 1024 * 1024) return { ok: false, error: "Photo too large (max 8 MB)." };

  const admin = createAdminClient();
  const path = `${userId}/${Date.now()}.jpg`;
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const up = await admin.storage.from("staff-photos").upload(path, bytes, { contentType: photo.type || "image/jpeg" });
  if (up.error) return { ok: false, error: up.error.message };

  const { error } = await admin.from("profiles").update({ photo_path: path }).eq("id", userId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "profiles",
    entityId: userId,
    diff: { photo: true },
  });
  revalidatePath("/employees");
  revalidatePath("/me");
  return { ok: true };
}

/** Set an employee's kiosk credentials (ID number + passcode). */
export async function setEmployeeCredentials(userId: string, employeeNo: string, passcode: string): Promise<ActionResult> {
  const user = await requireModuleWrite("employees");
  const emp = employeeNo.trim();
  if (!emp) return { ok: false, error: "Enter an ID number." };
  if (passcode && passcode.trim().length < 4) return { ok: false, error: "Passcode must be at least 4 characters." };

  const { hashPasscode } = await import("@/lib/employees/passcode");
  const admin = createAdminClient();

  // Enforce unique ID number across staff.
  const { data: clash } = await admin.from("profiles").select("id").eq("employee_no", emp).neq("id", userId).maybeSingle();
  if (clash) return { ok: false, error: "That ID number is already used by another employee." };

  const patch: Record<string, unknown> = { employee_no: emp };
  if (passcode.trim()) patch.passcode_hash = hashPasscode(emp, passcode);

  const { error } = await admin.from("profiles").update(patch).eq("id", userId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "profiles",
    entityId: userId,
    diff: { employee_no: emp, passcode_changed: Boolean(passcode.trim()) },
  });
  revalidatePath("/employees");
  return { ok: true };
}

/** Generate (or regenerate) a QR badge token for an employee. */
export async function generateEmployeeQr(userId: string): Promise<ActionResult> {
  const user = await requireModuleWrite("employees");
  if (!userId) return { ok: false, error: "Missing employee." };

  const { randomBytes } = await import("node:crypto");
  const token = randomBytes(24).toString("base64url");
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ qr_token: token }).eq("id", userId);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "profiles",
    entityId: userId,
    diff: { qr_token: "regenerated" },
  });
  revalidatePath("/employees");
  return { ok: true };
}

/** Update the public kiosk privacy settings (access code + show photos). */
export async function setKioskSettings(accessCode: string, showPhotos: boolean): Promise<ActionResult> {
  const user = await requireModuleWrite("employees");
  const supabase = await createClient();
  const { error } = await supabase
    .from("kiosk_settings")
    .update({ access_code: accessCode.trim(), show_photos: showPhotos, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "kiosk_settings",
    entityId: "1",
    diff: { access_code_set: Boolean(accessCode.trim()), show_photos: showPhotos },
  });
  revalidatePath("/employees");
  return { ok: true };
}

/** Approve or reject a leave request — approver roles (incl. owner) only. */
export async function decideLeave(id: string, status: "approved" | "rejected", note?: string): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, LEAVE_APPROVER_ROLES)) return { ok: false, error: "You cannot approve leave." };
  if (status !== "approved" && status !== "rejected") return { ok: false, error: "Invalid decision." };

  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("leave_requests")
    .update({ status, decided_by: user.userId, decided_at: new Date().toISOString(), decision_note: note || null })
    .eq("id", id)
    .eq("status", "pending")
    .select("user_id, leave_type, start_date, end_date")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "leave_requests",
    entityId: id,
    diff: { status },
  });

  // Announcement — notify the configured recipients of an approved leave so the
  // team can adjust coverage ahead of time. Best-effort; never blocks approval.
  if (status === "approved" && row) {
    const admin = createAdminClient();
    const { data: prof } = await admin.from("profiles").select("display_label").eq("id", row.user_id).maybeSingle();
    const who = (prof?.display_label as string) || "A staff member";
    await sendAlert({
      subject: `Approved leave: ${who} (${row.start_date}–${row.end_date})`,
      body: `${who} is on ${row.leave_type} leave from ${row.start_date} to ${row.end_date}. Please arrange coverage for any affected roles/tasks.`,
    }).catch(() => {});
  }

  revalidatePath("/employees");
  revalidatePath("/me");
  revalidatePath("/owner");
  return { ok: true };
}
