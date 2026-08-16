import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { BANK_BY_BUSINESS_LINE } from "@/lib/config";

export interface BankDepositConfig {
  id: string;
  category: string;
  bank_name: string;
  items: string[];
  notes: string | null;
}

/** Load all bank deposit configs from DB. Falls back to hardcoded config. Cached 5 min. */
export const getBankDepositConfigs = unstable_cache(
  async (): Promise<BankDepositConfig[]> => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("bank_deposit_configs")
      .select("id, category, bank_name, items, notes")
      .order("category");
    if (error || !data || data.length === 0) {
      // Fallback to hardcoded config
      return Object.entries(BANK_BY_BUSINESS_LINE).map(([category, bank_name]) => ({
        id: category,
        category,
        bank_name,
        items: [],
        notes: null,
      }));
    }
    return (data as BankDepositConfig[]);
  },
  ["bank-deposit-configs"],
  { revalidate: 300, tags: ["bank-deposit-configs"] },
);

/** Returns a map of category → bank_name for quick lookup in forms. */
export async function getBankNameMap(): Promise<Record<string, string>> {
  const configs = await getBankDepositConfigs();
  return Object.fromEntries(configs.map((c) => [c.category, c.bank_name]));
}

/** Returns a map of category → items[] for quick lookup. */
export async function getBankItemsMap(): Promise<Record<string, string[]>> {
  const configs = await getBankDepositConfigs();
  return Object.fromEntries(configs.map((c) => [c.category, c.items]));
}

/** Invalidate the cache after an admin update. */
export function invalidateBankConfigs() {
  revalidateTag("bank-deposit-configs", {});
}
