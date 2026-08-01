import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy-session";

/**
 * Next.js 16 renamed `middleware` to `proxy` (same functionality, Node runtime
 * by default). This runs before every matched route to keep the Supabase auth
 * session fresh.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on all paths EXCEPT static assets and image files, so auth logic
     * never blocks CSS/JS/images from loading.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
