"use server";

import { headers, cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPasscode } from "@/lib/employees/passcode";
import { logAudit } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts/sendAlert";
import { todayManila } from "@/lib/collections/summary";
import { getKioskSettings, kioskToken, KIOSK_COOKIE } from "@/lib/kiosk/settings";

/** Unlock the kiosk on this device by entering the access code. */
export async function unlockKiosk(_prev: { error: string } | undefined, formData: FormData): Promise<{ error: string } | undefined> {
  const code = String(formData.get("access_code") ?? "").trim();
  const { accessCode } = await getKioskSettings();
  if (!accessCode || code !== accessCode) return { error: "Incorrect access code." };
  const jar = await cookies();
  jar.set(KIOSK_COOKIE, kioskToken(accessCode), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return undefined;
}

export type KioskState =
  | { ok: true; message: string }
  | { ok: false; error: string }
  | { ok: false; needsObConfirm: true; message: string }
  | undefined;

// Best-effort rate limit (per IP). TODO(client-confirm): move to a shared store
// for multi-instance production.
const hits = new Map<string, { count: number; ts: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now - e.ts > 60_000) {
    hits.set(ip, { count: 1, ts: now });
    return false;
  }
  e.count++;
  return e.count > 12;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "local").split(",")[0].trim();
}

const BAD_CREDS = "ID number or passcode is incorrect.";

type Staff = { id: string; display_label: string };

/** Verify kiosk credentials → the staff profile, or null. */
async function verify(employeeNo: string, passcode: string): Promise<Staff | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, display_label, full_name, is_active, passcode_hash")
    .eq("employee_no", employeeNo.trim())
    .maybeSingle();
  if (!data || !data.is_active) return null;
  if (!data.passcode_hash || data.passcode_hash !== hashPasscode(employeeNo, passcode)) return null;
  return { id: data.id, display_label: (data.full_name as string) || data.display_label } as Staff;
}

/** Verify a scanned QR token → the staff profile, or null. */
async function verifyByToken(token: string): Promise<Staff | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("id, display_label, full_name, is_active")
    .eq("qr_token", token.trim())
    .maybeSingle();
  if (!data || !data.is_active) return null;
  return { id: data.id, display_label: (data.full_name as string) || data.display_label } as Staff;
}

/** Resolve staff from a scanned QR token OR manual ID + passcode. */
async function resolveStaff(formData: FormData): Promise<{ staff?: Staff; error?: string }> {
  const token = String(formData.get("qr_token") ?? "").trim();
  if (token) {
    const s = await verifyByToken(token);
    return s ? { staff: s } : { error: "QR badge not recognized." };
  }
  const employeeNo = String(formData.get("employee_no") ?? "").trim();
  const passcode = String(formData.get("passcode") ?? "").trim();
  if (!employeeNo || !passcode) return { error: "Enter your ID and passcode, or scan your QR badge." };
  const s = await verify(employeeNo, passcode);
  return s ? { staff: s } : { error: BAD_CREDS };
}

/** A photo is mandatory for every punch. */
function requirePhoto(formData: FormData): boolean {
  const p = formData.get("photo");
  return p instanceof File && p.size > 0;
}

/** Validate a scanned QR token (no punch) so the kiosk can enable the button. */
export async function validateQrToken(token: string): Promise<{ ok: true; label: string } | { ok: false; error: string }> {
  const ip = await clientIp();
  if (rateLimited(ip)) return { ok: false, error: "Too many attempts. Please wait a minute." };
  const t = token.trim();
  if (!t) return { ok: false, error: "Empty QR." };
  const staff = await verifyByToken(t);
  return staff ? { ok: true, label: staff.display_label } : { ok: false, error: "QR badge not recognized." };
}

async function uploadPhoto(userId: string, kind: "in" | "out", photo: FormDataEntryValue | null): Promise<string | null> {
  if (!(photo instanceof File) || photo.size === 0) return null;
  if (photo.size > 8 * 1024 * 1024) return null;
  const path = `${userId}/${todayManila()}/${kind}-${Date.now()}.jpg`;
  const bytes = new Uint8Array(await photo.arrayBuffer());
  const up = await createAdminClient().storage.from("attendance-photos").upload(path, bytes, { contentType: photo.type || "image/jpeg" });
  return up.error ? null : path;
}

export async function portalCheckIn(_prev: KioskState, formData: FormData): Promise<KioskState> {
  const ip = await clientIp();
  if (rateLimited(ip)) return { ok: false, error: "Too many attempts. Please wait a minute." };

  if (!requirePhoto(formData)) return { ok: false, error: "A photo is required — take your photo, then clock in." };

  const confirmObCancel = String(formData.get("confirm_ob_cancel") ?? "") === "true";
  const { staff, error: credErr } = await resolveStaff(formData);
  if (!staff) return { ok: false, error: credErr ?? BAD_CREDS };

  const admin = createAdminClient();
  const date = todayManila();

  // Already clocked in?
  const { data: open } = await admin
    .from("time_records")
    .select("id")
    .eq("user_id", staff.id)
    .is("time_out", null)
    .maybeSingle();
  if (open) return { ok: false, error: "You are already clocked in. Use Clock Out." };

  // Official Business today? Checking in cancels it — only with agreement.
  const { data: ob } = await admin
    .from("leave_requests")
    .select("id")
    .eq("user_id", staff.id)
    .eq("category", "ob")
    .eq("status", "approved")
    .lte("start_date", date)
    .gte("end_date", date)
    .maybeSingle();
  if (ob && !confirmObCancel) {
    return {
      ok: false,
      needsObConfirm: true,
      message: "You have an approved Official Business today. Checking in will CANCEL it. Do you agree?",
    };
  }
  if (ob && confirmObCancel) {
    await admin
      .from("leave_requests")
      .update({ status: "cancelled", decision_note: "Auto-cancelled: employee checked in on OB day." })
      .eq("id", ob.id);
    await sendAlert({
      subject: `OB cancelled: ${staff.display_label}`,
      body: `${staff.display_label} checked in on ${date}, cancelling their approved Official Business.`,
    }).catch(() => {});
  }

  const photo_path = await uploadPhoto(staff.id, "in", formData.get("photo"));
  const { data: rec, error } = await admin
    .from("time_records")
    .insert({ user_id: staff.id, time_in: new Date().toISOString(), time_in_photo: photo_path, ip_address: ip, source: "portal" })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: staff.id,
    actorRoles: ["kiosk"],
    action: "create",
    entity: "time_records",
    entityId: rec.id,
    diff: { event: "portal_check_in", ip, photo: Boolean(photo_path) },
  });
  revalidatePath("/attendance-portal");
  return { ok: true, message: `Checked in — welcome, ${staff.display_label}!` };
}

export async function portalCheckOut(_prev: KioskState, formData: FormData): Promise<KioskState> {
  const ip = await clientIp();
  if (rateLimited(ip)) return { ok: false, error: "Too many attempts. Please wait a minute." };

  if (!requirePhoto(formData)) return { ok: false, error: "A photo is required — take your photo, then clock out." };

  const { staff, error: credErr } = await resolveStaff(formData);
  if (!staff) return { ok: false, error: credErr ?? BAD_CREDS };

  const admin = createAdminClient();
  const { data: open } = await admin
    .from("time_records")
    .select("id, time_in")
    .eq("user_id", staff.id)
    .is("time_out", null)
    .order("time_in", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!open) return { ok: false, error: "You are not clocked in." };

  const photo_path = await uploadPhoto(staff.id, "out", formData.get("photo"));
  const now = new Date();
  const hours = open.time_in ? Math.round(((now.getTime() - new Date(open.time_in).getTime()) / 3_600_000) * 100) / 100 : null;

  const { error } = await admin
    .from("time_records")
    .update({ time_out: now.toISOString(), time_out_photo: photo_path, hours, ip_address: ip })
    .eq("id", open.id);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: staff.id,
    actorRoles: ["kiosk"],
    action: "update",
    entity: "time_records",
    entityId: open.id,
    diff: { event: "portal_check_out", ip, hours },
  });
  revalidatePath("/attendance-portal");
  return { ok: true, message: `Checked out — thank you, ${staff.display_label}! (${hours ?? 0}h)` };
}
