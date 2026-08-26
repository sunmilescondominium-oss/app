import { ALL_ROLE_KEYS } from "@/lib/rbac/modules";

/**
 * Hierarchical demo permissions — which roles may demo which target roles.
 * A user holding any grantor role may act-as any of its listed target roles.
 */
export const DEMO_HIERARCHY: Record<string, string[]> = {
  consultant: [...(ALL_ROLE_KEYS as readonly string[])],
  admin: (ALL_ROLE_KEYS as readonly string[]).filter((r) => r !== "consultant" && r !== "owner"),
  managing_officer: ["hotel_rental_monitoring", "hotel_cashier", "room_attendant"],
  hotel_rental_monitoring: ["hotel_cashier", "room_attendant"],
  accounting: ["hotel_cashier"],
};

/** Returns the set of roles the given user roles can demo. */
export function demoableRoles(userRoles: string[]): string[] {
  const result = new Set<string>();
  for (const [grantor, targets] of Object.entries(DEMO_HIERARCHY)) {
    if (userRoles.includes(grantor)) {
      for (const t of targets) result.add(t);
    }
  }
  return [...result];
}

/** Returns true if any of the user's roles allow demoing the target role. */
export function canDemoRole(userRoles: string[], targetRole: string): boolean {
  return Object.entries(DEMO_HIERARCHY).some(
    ([grantor, targets]) => userRoles.includes(grantor) && targets.includes(targetRole),
  );
}
