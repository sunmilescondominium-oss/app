"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSessionUser } from "@/lib/auth/dal";
import { ALL_ROLE_KEYS } from "@/lib/rbac/modules";
import { siteOrigin } from "@/lib/site-url";

export type LoginState = { error: string } | undefined;
export type ResetState = { ok?: boolean; sent?: boolean; error?: string } | undefined;

/** Send a password-reset email (Supabase). Always returns a generic success to
 *  avoid revealing whether an address exists. */
export async function requestPasswordReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Enter a valid email address." };

  const supabase = await createClient();
  const origin = await siteOrigin();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/reset` });
  return { sent: true };
}

/** Set a new password after following the reset link (recovery session active). */
export async function updatePasswordAfterReset(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const pw = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");
  if (pw.length < 8) return { error: "Use at least 8 characters." };
  if (pw !== confirm) return { error: "The two passwords do not match." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your reset link has expired. Request a new one." };

  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) return { error: error.message };

  // Setting the password via an emailed link proves the address is theirs —
  // stamp the email as verified.
  try {
    await createAdminClient().from("profiles").update({ email_verified_at: new Date().toISOString() }).eq("id", user.id);
  } catch {
    // non-fatal — the password change already succeeded.
  }

  await supabase.auth.signOut();
  redirect("/login?reset=1");
}

/**
 * Sign in with email + password (Supabase Auth). Used with useActionState, so
 * the signature is (previousState, formData). redirect() is intentionally
 * outside any try/catch (it throws a control-flow signal Next.js handles).
 */
export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Invalid email or password." };
  }

  // Disabled accounts may not enter — even with a valid password or reset link.
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profile && profile.is_active === false) {
    await supabase.auth.signOut();
    return { error: "This account is disabled. Please contact your administrator." };
  }

  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete("act_as_role");
  redirect("/login");
}

/**
 * "Act as role" — narrow the session to simulate a single role.
 * Users with canActAsAny (consultant/admin/owner) may preview ANY valid role.
 * Other users may only narrow to a role they personally hold.
 */
export async function setActAsRole(role: string | null): Promise<void> {
  const cookieStore = await cookies();
  if (!role) {
    cookieStore.delete("act_as_role");
    return;
  }
  const user = await getSessionUser();
  if (!user) return;
  const isValidRole = (ALL_ROLE_KEYS as readonly string[]).includes(role);
  const allowed = isValidRole && (user.canActAsAny || user.allRoleKeys.includes(role));
  if (allowed) {
    cookieStore.set("act_as_role", role, { httpOnly: true, sameSite: "lax", path: "/" });
  } else {
    cookieStore.delete("act_as_role");
  }
}
