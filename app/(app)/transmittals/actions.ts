"use server";

import { revalidatePath } from "next/cache";
import {
  requireAuth,
  requireModuleWrite,
  userHasAnyRole,
} from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { todayManila } from "@/lib/collections/summary";

export type ActionResult = { ok: true } | { ok: false; error: string };

function firstHeld(roleKeys: string[], preferred: string[]): string {
  return preferred.find((r) => roleKeys.includes(r)) ?? preferred[0];
}

/** Bundle a day's un-transmitted collections into a new transmittal. */
export async function buildTransmittalForDate(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["hotel_rental_monitoring", "accounting", "hotel_cashier"]))
    return { ok: false, error: "Only the cashier, monitoring, or accounting can build a transmittal." };

  // Service role: the action is already role-gated above; this lets the hotel
  // cashier bundle collections they can't read under the collections RLS.
  const supabase = createAdminClient();
  const date = String(formData.get("date") ?? "").trim();
  if (!date) return { ok: false, error: "Choose a date." };

  const { data: cols, error: cErr } = await supabase
    .from("collections")
    .select("id, amount")
    .eq("collected_on", date)
    .is("transmittal_id", null);
  if (cErr) return { ok: false, error: cErr.message };
  if (!cols || cols.length === 0)
    return { ok: false, error: "No un-transmitted collections found for that date." };

  const total = cols.reduce((s, c) => s + Number(c.amount), 0);
  const counted_by_role = firstHeld(user.roleKeys, ["hotel_cashier", "hotel_rental_monitoring", "accounting"]);

  // Optional PHP bill/coin count → the physical cash being transmitted.
  let denomination_counts: Record<string, number> | null = null;
  let counted_cash: number | null = null;
  const denomRaw = String(formData.get("denomination_counts") ?? "").trim();
  if (denomRaw) {
    try {
      const parsed = JSON.parse(denomRaw) as Record<string, number>;
      denomination_counts = parsed;
      counted_cash = Object.entries(parsed).reduce((s, [v, n]) => s + Number(v) * (Number(n) || 0), 0);
      counted_cash = Math.round(counted_cash * 100) / 100;
    } catch {
      /* ignore malformed count */
    }
  }

  const { data: t, error: tErr } = await supabase
    .from("transmittals")
    .insert({
      transmittal_date: date,
      total_amount: total,
      counted_by_role,
      denomination_counts,
      counted_cash,
      status: "submitted",
      created_by: user.userId,
    })
    .select("id")
    .single();
  if (tErr) return { ok: false, error: tErr.message };

  const { error: uErr } = await supabase
    .from("collections")
    .update({ transmittal_id: t.id as string })
    .in("id", cols.map((c) => c.id));
  if (uErr) return { ok: false, error: uErr.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "transmittals",
    entityId: t.id as string,
    diff: { date, total, count: cols.length },
  });
  revalidatePath("/transmittals");
  return { ok: true };
}

/** errand_liaison (or accounting/managing) confirms the bank deposit. */
export async function depositTransmittal(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireModuleWrite("transmittals");
  const supabase = await createClient();
  const deposit_slip_ref = String(formData.get("deposit_slip_ref") ?? "").trim();
  if (!deposit_slip_ref) return { ok: false, error: "Enter the deposit slip reference." };
  const depositedRaw = String(formData.get("deposited_amount") ?? "").trim();
  const deposited_amount = depositedRaw ? Number(depositedRaw) : null;
  if (deposited_amount != null && (!Number.isFinite(deposited_amount) || deposited_amount < 0))
    return { ok: false, error: "Enter a valid deposited amount." };

  const confirmed_by_role = firstHeld(user.roleKeys, [
    "errand_liaison",
    "accounting",
    "managing_officer",
  ]);
  const { error } = await supabase
    .from("transmittals")
    .update({ status: "deposited", deposit_slip_ref, deposited_amount, confirmed_by_role })
    .eq("id", id)
    .eq("status", "submitted");
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "transmittals",
    entityId: id,
    diff: { status: "deposited", deposit_slip_ref },
  });
  revalidatePath("/transmittals");
  revalidatePath(`/transmittals/${id}`);
  return { ok: true };
}

/** accounting records that the bank passbook was returned to them. */
export async function returnPassbook(id: string): Promise<ActionResult> {
  const user = await requireModuleWrite("transmittals");
  if (!userHasAnyRole(user, ["accounting", "managing_officer"]))
    return { ok: false, error: "Only accounting records the passbook return." };

  const supabase = await createClient();
  const passbook_returned_by_role = firstHeld(user.roleKeys, ["accounting", "managing_officer"]);
  const { error } = await supabase
    .from("transmittals")
    .update({ passbook_returned_on: todayManila(), passbook_returned_by_role })
    .eq("id", id)
    .in("status", ["deposited", "reconciled"]);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "transmittals",
    entityId: id,
    diff: { passbook_returned: true },
  });
  revalidatePath("/transmittals");
  revalidatePath(`/transmittals/${id}`);
  return { ok: true };
}

/** accounting reconciles the deposit slip. */
export async function reconcileTransmittal(id: string): Promise<ActionResult> {
  const user = await requireModuleWrite("transmittals");
  if (!userHasAnyRole(user, ["accounting", "managing_officer"]))
    return { ok: false, error: "Only accounting can reconcile." };

  const supabase = await createClient();
  const reconciled_by_role = firstHeld(user.roleKeys, ["accounting", "managing_officer"]);
  const { error } = await supabase
    .from("transmittals")
    .update({ status: "reconciled", reconciled_by_role })
    .eq("id", id)
    .eq("status", "deposited");
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "transmittals",
    entityId: id,
    diff: { status: "reconciled" },
  });
  revalidatePath("/transmittals");
  revalidatePath(`/transmittals/${id}`);
  return { ok: true };
}

export async function markTransmittalPrinted(id: string): Promise<ActionResult> {
  const user = await requireModuleWrite("transmittals");
  const supabase = await createClient();
  const { error } = await supabase
    .from("transmittals")
    .update({ printed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/transmittals/${id}`);
  return { ok: true };
}
