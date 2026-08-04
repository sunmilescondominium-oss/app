import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
 * Landing point for the password-reset email link. Establishes a recovery
 * session then sends the user to the set-new-password form.
 *
 * The recovery cookies MUST be written onto the redirect response we return
 * (not the ambient cookies() store) or they won't reach the browser — which
 * would leave /reset-password without a session.
 *
 * Supports both link styles:
 *   • token_hash + type   (recommended — works from ANY device / browser)
 *   • code                (PKCE — only the browser that requested it)
 *
 * Reliable token_hash template link:
 *   {{ .SiteURL }}/auth/reset?token_hash={{ .TokenHash }}&type=recovery
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const token_hash = sp.get("token_hash");
  const type = sp.get("type") as EmailOtpType | null;
  const code = sp.get("code");

  const response = NextResponse.redirect(new URL("/reset-password", req.nextUrl.origin));

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => response.cookies.set(name, value, options)),
      },
    },
  );

  try {
    if (token_hash && type) {
      await supabase.auth.verifyOtp({ token_hash, type });
    } else if (code) {
      await supabase.auth.exchangeCodeForSession(code);
    }
  } catch {
    // fall through — the reset page shows an "expired link" message if no session.
  }
  return response;
}
