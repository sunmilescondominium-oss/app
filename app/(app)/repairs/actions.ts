"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import { sendAlert } from "@/lib/alerts/sendAlert";
import { REPAIR_STATUSES } from "@/lib/config";

export type ActionResult = { ok: true } | { ok: false; error: string };
const STATUSES: readonly string[] = REPAIR_STATUSES.map((s) => s.key);

async function notifyRequester(contact: string | null, ticket: string, message: string) {
  if (contact && /@/.test(contact)) {
    await sendAlert({ to: contact, subject: `Repair ${ticket} update`, body: message }).catch(() => {});
  }
}

/** operations_manager assigns a submitted request to electrician / utility. */
export async function assignRepair(id: string, role: string): Promise<ActionResult> {
  const user = await requireModuleWrite("repair");
  if (!["electrician", "utility"].includes(role))
    return { ok: false, error: "Assign to electrician or utility." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repair_requests")
    .update({ assigned_to_role: role, status: "assigned" })
    .eq("id", id)
    .select("ticket_ref, requester_contact")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "repair_requests",
    entityId: id,
    diff: { assigned_to_role: role, status: "assigned" },
  });
  await notifyRequester(data.requester_contact, data.ticket_ref, `Your request ${data.ticket_ref} was assigned to ${role}.`);
  revalidatePath("/repairs");
  return { ok: true };
}

export async function setRepairStatus(id: string, status: string): Promise<ActionResult> {
  const user = await requireModuleWrite("repair");
  if (!STATUSES.includes(status)) return { ok: false, error: "Invalid status." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repair_requests")
    .update({ status })
    .eq("id", id)
    .select("ticket_ref, requester_contact")
    .single();
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "repair_requests",
    entityId: id,
    diff: { status },
  });
  await notifyRequester(data.requester_contact, data.ticket_ref, `Your request ${data.ticket_ref} is now "${status}".`);
  revalidatePath("/repairs");
  return { ok: true };
}
