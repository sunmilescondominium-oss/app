/** Shared types and pure utilities for collection item types — safe to import on client. */

export interface CollectionItemType {
  id: string;
  key: string;
  label: string;
  grp: string;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
}

export const ITEM_GROUP_LABELS: Record<string, string> = {
  hotel:       "Hotel",
  rental:      "Rental",
  airbnb:      "Airbnb",
  condo_sales: "Condo Sales",
  parking:     "Parking",
  utility:     "Utility",
  other:       "Other / Miscellaneous",
};

export const ITEM_GROUPS = Object.keys(ITEM_GROUP_LABELS);

/** Slugify a label to a stable key */
export function toItemKey(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}
