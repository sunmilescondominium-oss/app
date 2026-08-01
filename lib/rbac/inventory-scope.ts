import type { BusinessLineKey } from "@/lib/config";

/**
 * Which inventory business lines each role may SEE. "*" = all lines.
 * Single source of truth — editing this changes what a role sees, no deploy.
 * A user with multiple roles sees the UNION (or all, if any role is "*").
 *
 * TODO(client-confirm): confirm the exact per-role scoping.
 */
export const INVENTORY_SCOPE: Record<string, BusinessLineKey[] | "*"> = {
  // Oversight / back-office — everything
  owner: "*",
  admin: "*",
  managing_officer: "*",
  operations_manager: "*",
  accounting: "*",
  warehouse_timekeeper: "*",
  errand_liaison: "*",
  electrician: "*",
  utility: "*",
  // Sales side
  consultant: ["condo_sales"],
  broker: ["condo_sales"],
  // Rental + hotel + airbnb monitoring
  hotel_rental_monitoring: ["hotel", "rental", "airbnb"],
  // Hotel front-of-house / housekeeping
  hotel_cashier: ["hotel"],
  room_attendant: ["hotel"],
  guard: ["hotel", "rental"],
};

/** Business lines visible to the given roles: "all" or an explicit list. */
export function allowedBusinessLines(
  roleKeys: readonly string[],
): BusinessLineKey[] | "all" {
  const set = new Set<BusinessLineKey>();
  for (const rk of roleKeys) {
    const scope = INVENTORY_SCOPE[rk];
    if (scope === "*") return "all";
    if (Array.isArray(scope)) scope.forEach((l) => set.add(l));
  }
  if (set.size === 0) return "all"; // safe default for any unmapped staff role
  return [...set];
}
