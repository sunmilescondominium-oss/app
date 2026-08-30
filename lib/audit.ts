import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Append-only audit trail. Prime directive: record the actor BY ROLE, never by
 * name. Call this on every create/update/delete once mutating modules land.
 * Writes with the service role because audit_log is locked down under RLS.
 */
export async function logAudit(entry: {
  actorUserId?: string | null;
  actorRoles?: string[];
  action: "create" | "update" | "delete" | string;
  entity: string;
  entityId?: string | null;
  diff?: unknown;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_log").insert({
    actor_user_id: entry.actorUserId ?? null,
    actor_roles: entry.actorRoles ?? [],
    action: entry.action,
    entity: entry.entity,
    entity_id: entry.entityId ?? null,
    diff: entry.diff ?? null,
  });
  if (error) {
    console.error("audit_log insert failed:", error.message);
    // Fallback: write the failure itself to system_errors so it surfaces in /admin/health.
    try {
      await admin.from("system_errors").insert({
        source: "audit_log",
        message: `audit_log insert failed: ${error.message}`,
        context: { entity: entry.entity, action: entry.action, entityId: entry.entityId ?? null },
      });
    } catch { /* truly last-resort — never block */ }
  }
}
