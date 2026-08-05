"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPasscode } from "@/lib/employees/passcode";
import { logAudit } from "@/lib/audit";
import { todayManila } from "@/lib/collections/summary";
import { getPayrollSettings } from "@/lib/hr/queries";
import { EXTERNAL_ROLE_KEYS } from "@/lib/rbac/modules";

export type MobileState =
  | { ok: true; message: string; punctual?: "on_time" | "late" }
  | { ok: false; error: string }
  | undefined;

const hits = new Map<string, { count: number; ts: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now - e.ts > 60_000) { hits.set(ip, { count: 1, ts: now }); return false; }
  e.count++;
  return e.count > 12;
}

async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "local").split(",")[0].trim();
}

type Staff = { id: string; label: string };

async function isStaff(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin.from("user_roles").select("role_key").eq("user_id", userId);
  return (data ?? []).some((r) => !(EXTERNAL_ROLE_KEYS as readonly string[]).includes(r.role_key as string));
}

async function resolveStaff(fd: FormData): Promise<Staff | null> {
  const admin = createAdminClient();
  const token = String(fd.get("qr_token") ?? "").trim();
  if (token) {
    const { data } = await admin.from("profiles").select("id, display_label, full_name, is_active").eq("qr_token", token).maybeSingle();
    if (!data || !data.is_active) return null;
    return { id: data.id as string, label: (data.full_name as string) || (data.display_label as string) };
  }
  const employeeNo = String(fd.get("employee_no") ?? "").trim();
  const passcode = String(fd.get("passcode") ?? "").trim();
  if (!employeeNo || !passcode) return null;
  const { data } = await admin.from("profiles").select("id, display_label, full_name, is_active, passcode_hash").eq("employee_no", employeeNo).maybeSingle();
  if (!data || !data.is_active) return null;
  if (!data.passcode_hash || data.passcode_hash !== hashPasscode(employeeNo, passcode)) return null;
  return { id: data.id as string, label: (data.full_name as string) || (data.display_label as string) };
}

/** Look up an ACTIVE, unexpired outage by its code (auto-expires stale ones). */
async function activeOutage(code: string): Promise<{ id: string; punchKind: "in" | "out" } | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("kiosk_outages").select("id, status, expires_at, punch_kind").eq("code", code.trim().toUpperCase()).eq("status", "active").maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at as string).getTime() < Date.now()) {
    await admin.from("kiosk_outages").update({ status: "expired", closed_at: new Date().toISOString() }).eq("id", data.id);
    return null;
  }
  return { id: data.id as string, punchKind: data.punch_kind as "in" | "out" };
}

/** Validate a code (no punch) so the mobile page can unlock. */
export async function validateFallbackCode(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const ip = await clientIp();
  if (rateLimited(ip)) return { ok: false, error: "Too many attempts. Please wait a minute." };
  const o = await activeOutage(code);
  return o ? { ok: true } : { ok: false, error: "Code is invalid, expired, or the access was closed." };
}

function requirePhoto(fd: FormData): boolean {
  const p = fd.get("photo");
  return p instanceof File && p.size > 0;
}

async function uploadPhoto(userId: string, kind: "in" | "out", photo: FormDataEntryValue | null): Promise<string | null> {
  if (!(photo instanceof File) || photo.size === 0 || photo.size > 8 * 1024 * 1024) return null;
  const path = `${userId}/${todayManila()}/mobile-${kind}-${Date.now()}.jpg`;
  const up = await createAdminClient().storage.from("attendance-photos").upload(path, new Uint8Array(await photo.arrayBuffer()), { contentType: photo.type || "image/jpeg" });
  return up.error ? null : path;
}

function geoFrom(fd: FormData): { geo_lat: number | null; geo_lng: number | null; geo_accuracy: number | null } {
  const num = (k: string) => { const v = Number(fd.get(k)); return Number.isFinite(v) && v !== 0 ? v : null; };
  return { geo_lat: num("geo_lat"), geo_lng: num("geo_lng"), geo_accuracy: num("geo_accuracy") };
}

/** After a punch: mark this employee's grant used; close the outage if all done. */
async function markGrantAndMaybeClose(outageId: string, userId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("kiosk_outage_grants").update({ used_at: new Date().toISOString() }).eq("outage_id", outageId).eq("user_id", userId).is("used_at", null);
  const { data: grants } = await admin.from("kiosk_outage_grants").select("used_at").eq("outage_id", outageId);
  const allDone = (grants ?? []).length > 0 && (grants ?? []).every((g) => g.used_at);
  if (allDone) await admin.from("kiosk_outages").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", outageId).eq("status", "active");
}

async function common(fd: FormData): Promise<{ outageId: string; staff: Staff; ip: string } | { error: string }> {
  const ip = await clientIp();
  if (rateLimited(ip)) return { error: "Too many attempts. Please wait a minute." };
  if (!requirePhoto(fd)) return { error: "A photo is required — take your photo, then submit." };
  const code = String(fd.get("code") ?? "");
  const outage = await activeOutage(code);
  if (!outage) return { error: "Code is invalid, expired, or the access was closed." };
  const staff = await resolveStaff(fd);
  if (!staff) return { error: "ID/passcode is incorrect, or QR not recognized." };
  if (!(await isStaff(staff.id))) return { error: "This is for employees only." };
  const admin = createAdminClient();
  const { data: grant } = await admin.from("kiosk_outage_grants").select("id").eq("outage_id", outage.id).eq("user_id", staff.id).maybeSingle();
  if (!grant) return { error: "You are not on the authorized list for this instance. Ask the guard to include your ID." };
  return { outageId: outage.id, staff, ip };
}

export async function mobileCheckIn(_prev: MobileState, fd: FormData): Promise<MobileState> {
  const c = await common(fd);
  if ("error" in c) return { ok: false, error: c.error };
  const admin = createAdminClient();
  const { data: open } = await admin.from("time_records").select("id").eq("user_id", c.staff.id).is("time_out", null).maybeSingle();
  if (open) return { ok: false, error: "You are already clocked in. Use Clock Out." };

  const now = new Date();
  const photo_path = await uploadPhoto(c.staff.id, "in", fd.get("photo"));
  const geo = geoFrom(fd);
  const { data: rec, error } = await admin
    .from("time_records")
    .insert({ user_id: c.staff.id, time_in: now.toISOString(), time_in_photo: photo_path, ip_address: c.ip, source: "mobile_fallback", outage_id: c.outageId, ...geo })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const settings = await getPayrollSettings();
  const [sh, sm] = settings.scheduled_time_in.split(":").map(Number);
  const mins = (() => { const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Manila", hour: "2-digit", minute: "2-digit", hour12: false }).format(now); const [h, m] = hm.split(":").map(Number); return h * 60 + m; })();
  const punctual: "on_time" | "late" = mins > sh * 60 + sm + settings.grace_minutes ? "late" : "on_time";

  await markGrantAndMaybeClose(c.outageId, c.staff.id);
  await logAudit({ actorUserId: c.staff.id, actorRoles: ["kiosk_mobile"], action: "create", entity: "time_records", entityId: rec.id, diff: { event: "mobile_check_in", ip: c.ip, outageId: c.outageId, geo: Boolean(geo.geo_lat), punctual } });
  revalidatePath("/kiosk-access");
  return { ok: true, message: punctual === "on_time" ? `On time — welcome, ${c.staff.label}!` : `Checked in — welcome, ${c.staff.label}.`, punctual };
}

export async function mobileCheckOut(_prev: MobileState, fd: FormData): Promise<MobileState> {
  const c = await common(fd);
  if ("error" in c) return { ok: false, error: c.error };
  const admin = createAdminClient();
  const { data: open } = await admin.from("time_records").select("id, time_in").eq("user_id", c.staff.id).is("time_out", null).order("time_in", { ascending: false }).maybeSingle();
  if (!open) return { ok: false, error: "No open clock-in found. Use Clock In first." };

  const now = new Date();
  const photo_path = await uploadPhoto(c.staff.id, "out", fd.get("photo"));
  const geo = geoFrom(fd);
  const hours = open.time_in ? Math.round(((now.getTime() - new Date(open.time_in as string).getTime()) / 3_600_000) * 100) / 100 : null;
  const { error } = await admin.from("time_records").update({ time_out: now.toISOString(), time_out_photo: photo_path, hours, ip_address: c.ip, source: "mobile_fallback", outage_id: c.outageId, ...geo }).eq("id", open.id);
  if (error) return { ok: false, error: error.message };

  await markGrantAndMaybeClose(c.outageId, c.staff.id);
  await logAudit({ actorUserId: c.staff.id, actorRoles: ["kiosk_mobile"], action: "update", entity: "time_records", entityId: open.id as string, diff: { event: "mobile_check_out", ip: c.ip, outageId: c.outageId, geo: Boolean(geo.geo_lat) } });
  revalidatePath("/kiosk-access");
  return { ok: true, message: `Checked out — thank you, ${c.staff.label}! (${hours ?? 0}h)` };
}
