import "server-only";
import { unstable_cache, revalidateTag } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { BILLING_ITEM_TYPES } from "@/lib/config";

export type { CollectionItemType } from "./item-types-shared";
export { ITEM_GROUP_LABELS, ITEM_GROUPS, toItemKey } from "./item-types-shared";

import type { CollectionItemType } from "./item-types-shared";

const FALLBACK: CollectionItemType[] = BILLING_ITEM_TYPES.map((t, i) => ({
  id: t.key,
  key: t.key,
  label: t.label,
  grp: (t.lines as readonly string[])[0] ?? "other",
  sort_order: i * 10,
  is_active: true,
  is_system: true,
}));

export const getAllItemTypes = unstable_cache(
  async (): Promise<CollectionItemType[]> => {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("collection_item_types")
      .select("id, key, label, grp, sort_order, is_active, is_system")
      .order("sort_order");
    if (error || !data || data.length === 0) return FALLBACK;
    return data as CollectionItemType[];
  },
  ["collection-item-types-all"],
  { revalidate: 300, tags: ["collection-item-types"] },
);

export const getActiveItemTypes = unstable_cache(
  async (): Promise<CollectionItemType[]> => {
    const all = await getAllItemTypes();
    return all.filter((t) => t.is_active);
  },
  ["collection-item-types-active"],
  { revalidate: 300, tags: ["collection-item-types"] },
);

export function invalidateItemTypes() {
  revalidateTag("collection-item-types", {});
}
