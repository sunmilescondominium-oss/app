"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts/sendAlert";
import { REPAIR_URGENCY } from "@/lib/config";

export type SubmitState =
  | { ok: true; ticket: string }
  | { ok: false; error: string }
  | undefined;

const URGENCIES: readonly string[] = REPAIR_URGENCY.map((u) => u.key);

const hits = new Map<string, { count: number; ts: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now - e.ts > 60_000) {
    hits.set(ip, { count: 1, ts: now });
    return false;
  }
  e.count++;
  return e.count > 10;
}

function genTicket(): string {
  return `RR-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.toUpperCase();
}

export async function submitRepairRequest(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (rateLimited(ip)) return { ok: false, error: "Too many submissions. Please wait a minute." };

  const requester_type = String(formData.get("requester_type") ?? "tenant");
  if (!["tenant", "guest"].includes(requester_type))
    return { ok: false, error: "Invalid requester type." };

  const description = String(formData.get("description") ?? "").trim();
  if (description.length < 5) return { ok: false, error: "Please describe the issue." };

  const issue_type = String(formData.get("issue_type") ?? "").trim() || "General";
  const urgency = String(formData.get("urgency") ?? "normal");
  if (!URGENCIES.includes(urgency)) return { ok: false, error: "Choose an urgency." };

  const requester_ref = String(formData.get("requester_ref") ?? "").trim() || null;
  const requester_contact = String(formData.get("requester_contact") ?? "").trim() || null;
  const unit_number = String(formData.get("unit_number") ?? "").trim();

  const admin = createAdminClient();

  // Link to a unit if the number matches (no tenant/guest records to verify yet).
  // TODO(client-confirm): verify tenant unit#+PIN once the rentals module lands.
  let unit_id: string | null = null;
  if (unit_number) {
    const safe = unit_number.replace(/[%_\\]/g, "");
    const { data: units } = await admin.from("units").select("id").ilike("unit_number", safe).limit(1);
    unit_id = units?.[0]?.id ?? null;
  }

  const ticket = genTicket();

  let photo_path: string | null = null;
  const photo = formData.get("photo");
  if (photo instanceof File && photo.size > 0) {
    if (photo.size > 10 * 1024 * 1024) return { ok: false, error: "Photo too large (max 10 MB)." };
    const safeName = photo.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${ticket}/${Date.now()}-${safeName}`;
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const up = await admin.storage
      .from("repair-photos")
      .upload(path, bytes, { contentType: photo.type || "application/octet-stream" });
    if (!up.error) photo_path = path;
  }

  const { error } = await admin.from("repair_requests").insert({
    ticket_ref: ticket,
    unit_id,
    requester_type,
    requester_ref,
    requester_contact,
    issue_type,
    description,
    urgency,
    photo_path,
    status: "submitted",
    assigned_to_role: "operations_manager", // auto-assigned for triage
  });
  if (error) return { ok: false, error: "Could not submit. Please try again." };

  await logAudit({
    actorRoles: [requester_type],
    action: "create",
    entity: "repair_requests",
    entityId: ticket,
    diff: { issue_type, urgency },
  });

  // Best-effort notify operations that a request arrived.
  await sendAlert({
    subject: `New repair request ${ticket} (${urgency})`,
    body: `A ${requester_type} submitted a ${issue_type} repair request.\nUrgency: ${urgency}\n\n${description}`,
  }).catch(() => {});

  return { ok: true, ticket };
}
