import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AuthRequest } from "./types";

function mapRequest(r: Record<string, unknown>): AuthRequest {
  const prof = r.requester as { display_label?: string } | null;
  return {
    id: r.id as string,
    type: r.type as AuthRequest["type"],
    entity_id: r.entity_id as string,
    requested_by: r.requested_by as string | null,
    requester_role: r.requester_role as string | null,
    requester_label: prof?.display_label ?? (r.requester_role as string) ?? "Unknown",
    justification: r.justification as string,
    payload: (r.payload ?? {}) as Record<string, unknown>,
    status: r.status as AuthRequest["status"],
    reviewed_by: r.reviewed_by as string | null,
    reviewer_role: r.reviewer_role as string | null,
    reviewed_at: r.reviewed_at as string | null,
    review_note: r.review_note as string | null,
    expires_at: r.expires_at as string,
    created_at: r.created_at as string,
  };
}

export async function listPendingRequests(): Promise<AuthRequest[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("authorization_requests")
    .select("*")
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as Record<string, unknown>[];

  // Fetch display labels with a separate query (no direct FK to profiles).
  const ids = [...new Set(rows.map((r) => r.requested_by).filter(Boolean))] as string[];
  const labelMap = new Map<string, string>();
  if (ids.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, display_label")
      .in("id", ids);
    for (const p of (profs ?? []) as { id: string; display_label: string | null }[]) {
      if (p.display_label) labelMap.set(p.id, p.display_label);
    }
  }

  return rows.map((r) =>
    mapRequest({ ...r, requester: { display_label: labelMap.get(r.requested_by as string) ?? null } }),
  );
}

export async function getRequest(id: string): Promise<AuthRequest | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("authorization_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data ? mapRequest(data as Record<string, unknown>) : null;
}
