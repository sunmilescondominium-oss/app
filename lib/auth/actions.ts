"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/dal";

export type LoginState = { error: string } | undefined;

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
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Invalid email or password." };
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
 * "Act as role" — narrow the session's effective roles to a single role the
 * user actually holds. Restrict-only (never an escalation). Pass null to clear.
 */
export async function setActAsRole(role: string | null): Promise<void> {
  const cookieStore = await cookies();
  if (!role) {
    cookieStore.delete("act_as_role");
    return;
  }
  const user = await getSessionUser();
  if (user && user.allRoleKeys.includes(role)) {
    cookieStore.set("act_as_role", role, { httpOnly: true, sameSite: "lax", path: "/" });
  } else {
    cookieStore.delete("act_as_role");
  }
}
