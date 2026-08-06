"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireModuleWrite, userHasAnyRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { siteOrigin } from "@/lib/site-url";
import { logAudit } from "@/lib/audit";
import { ALL_ROLE_KEYS, INVITE_ROLES } from "@/lib/rbac/modules";
import { sendAlert } from "@/lib/alerts/sendAlert";
import { serverEnv } from "@/lib/env";
import { APP_BRAND } from "@/lib/config";
import type { ImportResult } from "@/lib/imports/types";
import type { BulkResult } from "@/lib/data/bulk";
import { randomBytes } from "node:crypto";

const USER_DELETE_ROLES = ["consultant", "admin"];

/** Bulk deactivate/reactivate users (soft — bans/unbans at the auth level too). */
export async function bulkSetUsersActive(ids: string[], active: boolean): Promise<BulkResult> {
  const actor = await requireModuleWrite("users");
  const list = Array.from(new Set(ids.filter(Boolean))).filter((id) => id !== actor.userId);
  if (list.length === 0) return { ok: false, error: "No rows selected (you can't deactivate yourself)." };
  const admin = createAdminClient();
  await admin.from("profiles").update({ is_active: active }).in("id", list);
  for (const id of list) {
    await admin.auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" }).catch(() => {});
  }
  await logAudit({ actorUserId: actor.userId, actorRoles: actor.roleKeys, action: active ? "update" : "delete", entity: "profiles", entityId: null, diff: { bulk_active: active, count: list.length } });
  revalidatePath("/users");
  return { ok: true, affected: list.length, skipped: [] };
}

/** Bulk PERMANENT delete users (removes the auth account — cascades profile &
 *  roles). Consultant/admin only; great for clearing demo accounts. */
export async function bulkDeleteUsers(ids: string[]): Promise<BulkResult> {
  const actor = await requireModuleWrite("users");
  if (!userHasAnyRole(actor, USER_DELETE_ROLES)) return { ok: false, error: "Only a consultant or admin can permanently delete accounts." };
  const list = Array.from(new Set(ids.filter(Boolean))).filter((id) => id !== actor.userId);
  if (list.length === 0) return { ok: false, error: "No rows selected (you can't delete yourself)." };
  if (list.length > 200) return { ok: false, error: "Select 200 or fewer per delete." };
  const admin = createAdminClient();
  let affected = 0;
  const skipped: { id: string; reason: string }[] = [];
  for (const id of list) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) skipped.push({ id, reason: error.message });
    else affected += 1;
  }
  await logAudit({ actorUserId: actor.userId, actorRoles: actor.roleKeys, action: "delete", entity: "auth.users", entityId: null, diff: { hard_delete: true, deleted: affected, skipped: skipped.length } });
  revalidatePath("/users");
  return { ok: true, affected, skipped };
}

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Bulk-add staff from CSV: creates a login user + roles per row. Existing emails
 * are skipped (no overwrite). A random temp password is set — admins should use
 * "Send reset" so each person sets their own. Optional daily_rate + employee_no.
 */
export async function bulkImportStaff(rows: Record<string, string>[]): Promise<ImportResult> {
  const actor = await requireModuleWrite("users");
  if (!Array.isArray(rows) || rows.length === 0) return { ok: false, error: "No rows to import." };
  if (rows.length > 500) return { ok: false, error: "Too many rows (max 500 per import)." };
  const admin = createAdminClient();
  const errors: { row: number; error: string }[] = [];
  let inserted = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 2;
    const email = (r.email ?? "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { errors.push({ row: line, error: "invalid or missing email" }); continue; }

    const label = (r.display_label ?? "").trim() || "Staff Member";
    const roles = Array.from(new Set((r.roles ?? "").split(/[|;,]/).map((x) => x.trim()).filter(Boolean)));
    const badRole = roles.find((rk) => !ALL_ROLE_KEYS.includes(rk as (typeof ALL_ROLE_KEYS)[number]));
    if (badRole) { errors.push({ row: line, error: `unknown role "${badRole}"` }); continue; }

    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password: randomBytes(18).toString("base64url"),
      email_confirm: true,
      user_metadata: { display_label: label },
    });
    if (cErr || !created.user) { errors.push({ row: line, error: cErr?.message ?? "could not create user (email may already exist)" }); continue; }
    const userId = created.user.id;

    await admin.from("profiles").update({ display_label: label }).eq("id", userId);
    if (roles.length) await admin.from("user_roles").insert(roles.map((rk) => ({ user_id: userId, role_key: rk })));

    const emp = (r.employee_no ?? "").trim();
    if (emp) await admin.from("profiles").update({ employee_no: emp }).eq("id", userId);

    const rate = Number(r.daily_rate);
    if (Number.isFinite(rate) && rate > 0) {
      await admin.from("staff_pay").upsert({ user_id: userId, daily_rate: rate }, { onConflict: "user_id" });
    }
    inserted += 1;
  }

  await logAudit({ actorUserId: actor.userId, actorRoles: actor.roleKeys, action: "create", entity: "profiles", entityId: null, diff: { staff_imported: inserted, skipped: errors.length } });
  revalidatePath("/users");
  revalidatePath("/employees");
  return { ok: true, inserted, errors: errors.length ? errors : undefined };
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** A one-time Supabase recovery link that lets the user set their own password. */
async function generateRecoveryLink(email: string): Promise<{ link?: string; error?: string }> {
  const admin = createAdminClient();
  const origin = await siteOrigin();
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: `${origin}/auth/reset` },
  });
  if (error) return { error: error.message };
  const link = (data?.properties as { action_link?: string } | undefined)?.action_link;
  return link ? { link } : { error: "Could not generate the access link." };
}

function inviteEmail(email: string, link: string, origin: string): { subject: string; body: string } {
  return {
    subject: `${APP_BRAND} — verify your email and set your password`,
    body:
      `Hello,\n\n` +
      `An account has been created for you in the ${APP_BRAND} system.\n\n` +
      `To get started:\n` +
      `1) Click the secure link below to VERIFY YOUR EMAIL and SET YOUR OWN PASSWORD:\n   ${link}\n\n` +
      `2) After setting your password, sign in here:\n   ${origin}/login\n   Use your email (${email}) and the password you just set.\n\n` +
      `This link can be used once and expires for your security. If it expires, ask your administrator to resend it, or use "Forgot password" on the sign-in page.\n\n` +
      `Clicking the link confirms this email address is correct and verified.\n\n` +
      `— ${APP_BRAND}`,
  };
}

function resetEmail(email: string, link: string): { subject: string; body: string } {
  return {
    subject: `${APP_BRAND} — reset your password`,
    body:
      `Hello,\n\n` +
      `A password reset was requested for your ${APP_BRAND} account (${email}).\n\n` +
      `Click the secure link below to set a new password:\n   ${link}\n\n` +
      `If you didn't request this, you can ignore this email. The link can be used once and expires for your security.\n\n` +
      `— ${APP_BRAND}`,
  };
}

type MailResult = { ok: true; info?: string } | { ok: false; error: string };

/**
 * Deliver a recovery email. Preferred path: the app mailer (sendAlert) with our
 * custom instructions. If the app mailer isn't configured, fall back to
 * Supabase Auth's own email (the transport that already powers the login
 * "Forgot password" flow) so delivery still works with a generic template.
 * Reports which transport actually sent so failures aren't hidden.
 */
async function deliverRecovery(email: string, mode: "invite" | "reset"): Promise<MailResult> {
  try {
    const origin = await siteOrigin();
    const redirectTo = `${origin}/auth/reset`;

    let appNote = "no app-mailer link";
    const { link, error: linkErr } = await generateRecoveryLink(email);
    if (link) {
      const { subject, body } = mode === "invite" ? inviteEmail(email, link, origin) : resetEmail(email, link);
      const sent = await sendAlert({ subject, body, to: email });
      if (sent.ok) return { ok: true, info: `sent via app mailer (${serverEnv.alertDriver})` };
      appNote = sent.skipped
        ? `app mailer not configured (driver=${serverEnv.alertDriver})`
        : `app mailer error: ${sent.error ?? "unknown"}`;
    } else {
      appNote = `could not build link: ${linkErr ?? "unknown"}`;
    }

    // Fallback: Supabase's own sender (generic template).
    const supabase = await createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) return { ok: false, error: `App mailer unavailable (${appNote}). Supabase fallback also failed: ${error.message}` };
    return { ok: true, info: `app mailer unavailable (${appNote}) — sent via Supabase fallback (generic template)` };
  } catch (e) {
    return { ok: false, error: `Mail delivery threw: ${e instanceof Error ? e.message : "unknown error"}` };
  }
}

/**
 * Diagnostic: send a plain test email through the app mailer and return the raw
 * result verbatim (driver + ok/skipped/error) so an admin can see exactly what
 * the SMTP/Resend transport reports. No fallback — this tests one path only.
 */
export async function sendTestEmail(to: string): Promise<{ ok: boolean; detail: string }> {
  const actor = await requireAuth();
  if (!userHasAnyRole(actor, [...INVITE_ROLES])) return { ok: false, detail: "Not allowed." };
  const addr = to.trim().toLowerCase();
  if (!EMAIL_RE.test(addr)) return { ok: false, detail: "Enter a valid email address." };
  try {
    const r = await sendAlert({
      subject: `${APP_BRAND} — test email`,
      body: `This is a test email from ${APP_BRAND} to confirm outgoing mail works. If you received it, invites will send too.`,
      to: addr,
    });
    const detail = `driver=${serverEnv.alertDriver} · ok=${r.ok}${r.skipped ? " · skipped (transport not configured)" : ""}${r.error ? ` · error=${r.error}` : ""}`;
    return { ok: r.ok, detail };
  } catch (e) {
    return { ok: false, detail: `driver=${serverEnv.alertDriver} · threw: ${e instanceof Error ? e.message : "unknown"}` };
  }
}

/**
 * Non-secret snapshot of the mail configuration, for the Users page to show
 * admins why an invite may not have sent. Never returns credential values.
 */
export async function mailConfigStatus(): Promise<{ driver: string; smtpUser: boolean; smtpPass: boolean; resendKey: boolean }> {
  await requireAuth();
  return {
    driver: serverEnv.alertDriver,
    smtpUser: Boolean(serverEnv.smtpUser),
    smtpPass: Boolean(serverEnv.smtpPass),
    resendKey: Boolean(serverEnv.resendApiKey),
  };
}

/**
 * Send a first-time access / verification email: the user clicks a secure link
 * to verify their email and set their own password. Admin, consultant, and
 * accounting may trigger this. We never email a plaintext password.
 */
export async function sendAccessInvite(userId: string): Promise<MailResult> {
  const actor = await requireAuth();
  if (!userHasAnyRole(actor, [...INVITE_ROLES])) return { ok: false, error: "Only admin, consultant, or accounting can send access emails." };

  const admin = createAdminClient();
  const { data: got, error: getErr } = await admin.auth.admin.getUserById(userId);
  if (getErr || !got.user?.email) return { ok: false, error: "No email address on file for this user." };
  const email = got.user.email.toLowerCase();

  const sent = await deliverRecovery(email, "invite");
  if (!sent.ok) return sent;

  await admin.from("profiles").update({ invite_sent_at: new Date().toISOString() }).eq("id", userId);
  await logAudit({ actorUserId: actor.userId, actorRoles: actor.roleKeys, action: "update", entity: "auth.users", entityId: email, diff: { access_invite_sent: true, transport: sent.info } });
  revalidatePath("/users");
  return sent;
}

/** Send a password-reset email (forgot-password help). Admin/consultant/accounting. */
export async function sendUserPasswordReset(email: string): Promise<MailResult> {
  const actor = await requireAuth();
  if (!userHasAnyRole(actor, [...INVITE_ROLES])) return { ok: false, error: "Only admin, consultant, or accounting can send reset emails." };
  const addr = email.trim().toLowerCase();
  if (!EMAIL_RE.test(addr)) return { ok: false, error: "Invalid email." };

  const sent = await deliverRecovery(addr, "reset");
  if (!sent.ok) return sent;

  await logAudit({ actorUserId: actor.userId, actorRoles: actor.roleKeys, action: "update", entity: "auth.users", entityId: addr, diff: { password_reset_sent: true, transport: sent.info } });
  return sent;
}

const VALID_ROLES: readonly string[] = ALL_ROLE_KEYS;

function cleanRoles(roleKeys: string[]): string[] {
  return Array.from(new Set(roleKeys.filter((r) => VALID_ROLES.includes(r))));
}

/** Replace a user's entire role set (task-based access). */
/**
 * Change a user's LOGIN email (the Supabase auth email used to sign in) — not
 * the 201-file personal email. The new address becomes usable immediately with
 * their existing password; it is marked unverified until they confirm it via a
 * "Send invite" link. Admin (+ consultant super) only.
 */
export async function setUserEmail(userId: string, newEmail: string): Promise<ActionResult> {
  const actor = await requireModuleWrite("users");
  const addr = newEmail.trim().toLowerCase();
  if (!EMAIL_RE.test(addr)) return { ok: false, error: "Enter a valid email address." };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(userId, { email: addr, email_confirm: true });
  if (error) {
    if (/already|registered|exists|duplicate/i.test(error.message)) return { ok: false, error: "That email is already used by another account." };
    return { ok: false, error: error.message };
  }
  // New address hasn't been proven by the user yet — reset verification state.
  await admin.from("profiles").update({ email_verified_at: null, invite_sent_at: null }).eq("id", userId);
  await logAudit({ actorUserId: actor.userId, actorRoles: actor.roleKeys, action: "update", entity: "auth.users", entityId: userId, diff: { login_email: addr } });
  revalidatePath("/users");
  return { ok: true };
}

/** Rename a user's display label (shown across the app). */
export async function setUserDisplayLabel(userId: string, label: string): Promise<ActionResult> {
  const actor = await requireModuleWrite("users");
  const value = label.trim();
  if (!value) return { ok: false, error: "Display label can't be empty." };
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ display_label: value }).eq("id", userId);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: actor.userId, actorRoles: actor.roleKeys, action: "update", entity: "profiles", entityId: userId, diff: { display_label: value } });
  revalidatePath("/users");
  revalidatePath("/employees");
  return { ok: true };
}

/** Set the display order of roles (kiosk board + role lists). Lower shows first. */
export async function reorderRoles(orderedKeys: string[]): Promise<ActionResult> {
  const actor = await requireModuleWrite("users");
  if (!Array.isArray(orderedKeys) || orderedKeys.length === 0) return { ok: false, error: "Nothing to save." };
  const admin = createAdminClient();
  for (let i = 0; i < orderedKeys.length; i++) {
    const { error } = await admin.from("roles").update({ sort_order: (i + 1) * 10 }).eq("role_key", orderedKeys[i]);
    if (error) return { ok: false, error: error.message };
  }
  await logAudit({ actorUserId: actor.userId, actorRoles: actor.roleKeys, action: "update", entity: "roles", entityId: null, diff: { order: orderedKeys } });
  revalidatePath("/users/access");
  return { ok: true };
}

export async function setUserRoles(
  userId: string,
  roleKeys: string[],
): Promise<ActionResult> {
  const actor = await requireModuleWrite("users");
  const admin = createAdminClient();
  const roles = cleanRoles(roleKeys);

  const { error: delErr } = await admin
    .from("user_roles")
    .delete()
    .eq("user_id", userId);
  if (delErr) return { ok: false, error: delErr.message };

  if (roles.length > 0) {
    const rows = roles.map((rk) => ({ user_id: userId, role_key: rk }));
    const { error: insErr } = await admin.from("user_roles").insert(rows);
    if (insErr) return { ok: false, error: insErr.message };
  }

  await logAudit({
    actorUserId: actor.userId,
    actorRoles: actor.roleKeys,
    action: "update",
    entity: "user_roles",
    entityId: userId,
    diff: { roleKeys: roles },
  });
  revalidatePath("/users");
  return { ok: true };
}

export async function createUser(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const actor = await requireModuleWrite("users");
  const admin = createAdminClient();

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const displayLabel = String(formData.get("display_label") ?? "").trim() || "New Member";
  const roles = cleanRoles(formData.getAll("roles").map(String));

  if (!email) return { ok: false, error: "Email is required." };
  if (password.length < 6)
    return { ok: false, error: "Password must be at least 6 characters." };

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_label: displayLabel },
  });
  if (error) return { ok: false, error: error.message };
  const userId = data.user?.id;
  if (!userId) return { ok: false, error: "Could not create the user." };

  // Profile is created by the on-auth-user-created trigger; set label + roles.
  await admin.from("profiles").update({ display_label: displayLabel }).eq("id", userId);
  if (roles.length > 0) {
    await admin.from("user_roles").insert(roles.map((rk) => ({ user_id: userId, role_key: rk })));
  }

  await logAudit({
    actorUserId: actor.userId,
    actorRoles: actor.roleKeys,
    action: "create",
    entity: "profiles",
    entityId: userId,
    diff: { email, roleKeys: roles },
  });
  revalidatePath("/users");
  return { ok: true };
}

export async function setUserActive(
  userId: string,
  active: boolean,
): Promise<ActionResult> {
  const actor = await requireModuleWrite("users");
  if (!active && userId === actor.userId) return { ok: false, error: "You can't deactivate your own account." };
  const admin = createAdminClient();

  const { error } = await admin
    .from("profiles")
    .update({ is_active: active })
    .eq("id", userId);
  if (error) return { ok: false, error: error.message };

  // Enforce at the Supabase Auth level too: a ban blocks any new login (password
  // OR reset link) and invalidates the account's existing refresh tokens.
  const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : "876000h", // ~100 years = effectively permanent until reactivated
  });
  if (banErr) return { ok: false, error: `Access flag saved, but auth ${active ? "unban" : "ban"} failed: ${banErr.message}` };

  await logAudit({
    actorUserId: actor.userId,
    actorRoles: actor.roleKeys,
    action: "update",
    entity: "profiles",
    entityId: userId,
    diff: { is_active: active },
  });
  revalidatePath("/users");
  return { ok: true };
}
