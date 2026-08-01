import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

/**
 * Service-role Supabase client. BYPASSES RLS — server-only, never sent to the
 * browser. Use exclusively for trusted server operations: audit logging, the
 * public PIN portals (which must read across rows via a controlled server
 * route), and admin tasks. Prefer the RLS-enforced server client everywhere
 * else.
 */
export function createAdminClient() {
  return createSupabaseClient(serverEnv.supabaseUrl, serverEnv.serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
