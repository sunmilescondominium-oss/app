import { type NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Landing point for the password-reset email link. Establishes a recovery
 * session then sends the user to the set-new-password form.
 *
 * Supports both link styles:
 *   • token_hash + type   (recommended — works from ANY device / browser)
 *   • code                (PKCE — only works in the browser that requested it)
 *
 * For the reliable token_hash flow, the Supabase "Reset Password" email
 * template must link to:  {{ .SiteURL }}/auth/reset?token_hash={{ .TokenHash }}&type=recovery
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const token_hash = sp.get("token_hash");
  const type = sp.get("type") as EmailOtpType | null;
  const code = sp.get("code");

  const supabase = await createClient();
  try {
    if (token_hash && type) {
      await supabase.auth.verifyOtp({ token_hash, type });
    } else if (code) {
      await supabase.auth.exchangeCodeForSession(code);
    }
  } catch {
    // fall through — the reset page shows an "expired link" message if no session.
  }
  return NextResponse.redirect(new URL("/reset-password", req.nextUrl.origin));
}
