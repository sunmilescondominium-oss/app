"use server";

import { requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { invalidateItemTypes, toItemKey } from "@/lib/collections/item-types";
import { revalidatePath } from "next/cache";

const ALLOWED = ["accounting", "admin", "managing_officer", "consultant"] as const;

function guard(user: Awaited<ReturnType<typeof requireAuth>>) {
  if (!userHasAnyRole(user, [...ALLOWED]))
    return "Only accounting and admin can manage collection item types.";
  return null;
}

export async function addItemType(
  label: string,
  grp: string,
  sortOrder: number,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth();
  const err = guard(user);
  if (err) return { ok: false, error: err };

  const key = toItemKey(label);
  if (!key) return { ok: false, error: "Label is required." };

  const admin = createAdminClient();
  const { error } = await admin.from("collection_item_types").insert({
    key,
    label: label.trim(),
    grp,
    sort_order: sortOrder,
    is_system: false,
    created_by: user.userId,
    updated_by: user.userId,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, error: `Key "${key}" already exists. Use a different label.` };
    return { ok: false, error: error.message };
  }

  invalidateItemTypes();
  revalidatePath("/admin/collection-items");
  return { ok: true };
}

export async function updateItemType(
  id: string,
  label: string,
  grp: string,
  sortOrder: number,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth();
  const err = guard(user);
  if (err) return { ok: false, error: err };

  const admin = createAdminClient();
  const { error } = await admin
    .from("collection_item_types")
    .update({ label: label.trim(), grp, sort_order: sortOrder, updated_by: user.userId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  invalidateItemTypes();
  revalidatePath("/admin/collection-items");
  return { ok: true };
}

export async function toggleItemActive(
  id: string,
  isActive: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth();
  const err = guard(user);
  if (err) return { ok: false, error: err };

  const admin = createAdminClient();
  const { error } = await admin
    .from("collection_item_types")
    .update({ is_active: isActive, updated_by: user.userId, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  invalidateItemTypes();
  revalidatePath("/admin/collection-items");
  return { ok: true };
}

export async function checkItemUsage(
  id: string,
): Promise<{ ok: boolean; error?: string; key?: string; collections?: number; billingRates?: number; billingRecords?: number }> {
  const user = await requireAuth();
  const err = guard(user);
  if (err) return { ok: false, error: err };

  const admin = createAdminClient();
  const { data: item, error: fetchErr } = await admin
    .from("collection_item_types")
    .select("key, is_system")
    .eq("id", id)
    .single();
  if (fetchErr || !item) return { ok: false, error: "Item not found." };
  if (item.is_system) return { ok: false, error: "System items cannot be deleted." };

  const key = item.key as string;
  const [colRes, ratesRes, recsRes] = await Promise.all([
    admin.from("collections").select("id", { count: "exact", head: true }).eq("charge_type", key),
    admin.from("unit_billing_rates").select("id", { count: "exact", head: true }).eq("item_key", key),
    admin.from("unit_billing_records").select("id", { count: "exact", head: true }).eq("item_key", key),
  ]);
  return {
    ok: true,
    key,
    collections: colRes.count ?? 0,
    billingRates: ratesRes.count ?? 0,
    billingRecords: recsRes.count ?? 0,
  };
}

export async function deleteItemType(
  id: string,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, ["admin", "accounting", "consultant"]))
    return { ok: false, error: "Access denied." };

  const admin = createAdminClient();
  const { data: item, error: fetchErr } = await admin
    .from("collection_item_types")
    .select("is_system")
    .eq("id", id)
    .single();
  if (fetchErr || !item) return { ok: false, error: "Item not found." };
  if (item.is_system) return { ok: false, error: "System items cannot be deleted." };

  const { error } = await admin.from("collection_item_types").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };

  invalidateItemTypes();
  revalidatePath("/admin/collection-items");
  return { ok: true };
}
