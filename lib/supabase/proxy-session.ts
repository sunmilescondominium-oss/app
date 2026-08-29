import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session cookie on every request and performs an
 * OPTIMISTIC redirect of unauthenticated users away from protected routes.
 * Invoked from the root proxy.ts (Next 16's renamed middleware).
 *
 * Security note: this is only an optimistic gate. The authoritative check is
 * requireAuth()/requireModule() in the Data Access Layer, run per page.
 */

// Routes reachable without a signed-in staff session.
const PUBLIC_PREFIXES = ["/login", "/buyer-portal", "/repair-request", "/attendance-portal", "/mobile-clock", "/renter-portal", "/guest", "/airbnb", "/auth/reset", "/reset-password"];

function isPublicPath(path: string): boolean {
  if (path === "/") return true; // root decides where to send you
  return PUBLIC_PREFIXES.some((p) => path === p || path.startsWith(p + "/"));
}

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Not configured yet (placeholder env): let the app render its setup notice
  // instead of crashing.
  if (!url || !anon || url.includes("YOUR-PROJECT-ref")) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT (Supabase): do not run logic between client creation and getUser,
  // and always return supabaseResponse so the refreshed cookie is sent back.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Idle session timeout — only for authenticated staff on protected routes.
  if (user && !isPublicPath(request.nextUrl.pathname)) {
    const timeoutMs =
      parseInt(process.env.SESSION_TIMEOUT_MINUTES ?? "240", 10) * 60_000;
    const lastActiveCookie = request.cookies.get("last_active_at");
    const now = Date.now();

    if (lastActiveCookie) {
      const lastActive = parseInt(lastActiveCookie.value, 10);
      if (!isNaN(lastActive) && now - lastActive > timeoutMs) {
        // Session idle too long — sign out and redirect.
        await supabase.auth.signOut();
        const url = request.nextUrl.clone();
        url.pathname = "/login";
        url.searchParams.set("timeout", "1");
        const res = NextResponse.redirect(url);
        // Copy cleared auth cookies from supabaseResponse to the redirect.
        for (const cookie of supabaseResponse.cookies.getAll()) {
          res.cookies.set(cookie.name, cookie.value, cookie);
        }
        res.cookies.delete("last_active_at");
        return res;
      }
    }

    // Stamp last active time on every response.
    supabaseResponse.cookies.set("last_active_at", String(now), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 86400,
    });
  }

  return supabaseResponse;
}
