import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Landing point for the password-reset email link. Exchanges the recovery code
 * for a session (cookies are settable in a route handler), then sends the user
 * to the set-new-password form.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const supabase = await createClient();
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }
  return NextResponse.redirect(new URL("/reset-password", req.nextUrl.origin));
}
