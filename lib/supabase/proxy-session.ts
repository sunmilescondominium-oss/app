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
const PUBLIC_PREFIXES = ["/login", "/buyer-portal", "/repair-request", "/attendance-portal", "/renter-portal", "/guest", "/airbnb", "/auth/reset", "/reset-password"];

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

  return supabaseResponse;
}
