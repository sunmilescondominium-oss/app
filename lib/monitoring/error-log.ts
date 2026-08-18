import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface SystemError {
  id: string;
  context: string;
  message: string;
  detail: string | null;
  createdAt: string;
}

/** Log an error to the system_errors table. Safe to call and forget (never throws). */
export async function logError(context: string, err: unknown): Promise<void> {
  try {
    const admin = createAdminClient();
    const message = err instanceof Error ? err.message : String(err);
    const detail = err instanceof Error && err.stack ? err.stack : null;
    await admin.from("system_errors").insert({ context, message, detail });
  } catch {
    // Never let the logger itself crash the caller
  }
}

/** List the most recent system errors. */
export async function listSystemErrors(limit = 30): Promise<SystemError[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("system_errors")
    .select("id, context, message, detail, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    context: r.context as string,
    message: r.message as string,
    detail: (r.detail as string | null) ?? null,
    createdAt: r.created_at as string,
  }));
}

/** Delete all system errors (for use from the health page). */
export async function clearSystemErrors(): Promise<void> {
  const admin = createAdminClient();
  await admin.from("system_errors").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}
