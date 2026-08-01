import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (anon key, RLS-enforced). For use in client
 * components only. Never handles the service-role key.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
