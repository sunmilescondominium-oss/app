"use server";

import { requireAuth } from "@/lib/auth/dal";
import { userHasAnyRole } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { invalidateBankConfigs } from "@/lib/collections/bank-config";
import { revalidatePath } from "next/cache";

const ALLOWED = ["admin", "managing_officer", "accounting", "consultant"] as const;

export async function updateBankConfig(
  category: string,
  bankName: string,
  items: string[],
  notes: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, [...ALLOWED]))
    return { ok: false, error: "Only accounting and management can update bank config." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("bank_deposit_configs")
    .upsert(
      { category, bank_name: bankName, items, notes: notes || null, updated_by: user.userId, updated_at: new Date().toISOString() },
      { onConflict: "category" },
    );
  if (error) return { ok: false, error: error.message };

  invalidateBankConfigs();
  revalidatePath("/admin/bank-config");
  return { ok: true };
}
