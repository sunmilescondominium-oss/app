import { requireAuth } from "@/lib/auth/dal";
import { redirect } from "next/navigation";
import { getAllPairs } from "@/lib/chat/permissions";
import { PageHeader } from "@/components/ui";
import { ChatPermToggle } from "./toggle-client";

export const metadata = { title: "Chat Permissions" };

const SUPER = ["admin", "managing_officer", "consultant"];

const ROLE_LABELS: Record<string, string> = {
  admin:                    "Admin",
  managing_officer:         "Managing Officer",
  consultant:               "Consultant",
  operations_manager:       "Operations Manager",
  accounting:               "Accounting",
  hotel_rental_monitoring:  "Hotel/Rental Monitoring",
  hotel_cashier:            "Hotel Cashier",
  room_attendant:           "Room Attendant",
  guard:                    "Guard",
  electrician:              "Electrician",
  utility:                  "Utility/Maintenance",
  warehouse_timekeeper:     "Warehouse Timekeeper",
  errand_liaison:           "Errand Liaison",
  owner:                    "Owner",
};

// Roles that can be toggled (non-management staff pairs)
const STAFF_ROLES = [
  "operations_manager",
  "accounting",
  "hotel_rental_monitoring",
  "hotel_cashier",
  "room_attendant",
  "guard",
  "electrician",
  "utility",
  "warehouse_timekeeper",
  "errand_liaison",
  "owner",
];

/** Build the canonical full pair list merged with DB-stored values. */
function buildFullPairList(
  dbPairs: Array<{ role_a: string; role_b: string; enabled: boolean }>,
) {
  const dbMap = new Map(dbPairs.map((p) => [`${p.role_a}:${p.role_b}`, p.enabled]));

  const all: Array<{ role_a: string; role_b: string; enabled: boolean }> = [];
  for (let i = 0; i < STAFF_ROLES.length; i++) {
    for (let j = i + 1; j < STAFF_ROLES.length; j++) {
      const [a, b] = STAFF_ROLES[i] < STAFF_ROLES[j]
        ? [STAFF_ROLES[i], STAFF_ROLES[j]]
        : [STAFF_ROLES[j], STAFF_ROLES[i]];
      const key = `${a}:${b}`;
      all.push({ role_a: a, role_b: b, enabled: dbMap.get(key) ?? false });
    }
  }
  return all;
}

export default async function ChatPermissionsPage() {
  const user = await requireAuth();
  if (!user.roleKeys.some((r) => SUPER.includes(r as string))) redirect("/dashboard");

  const dbPairs = await getAllPairs();
  const pairs = buildFullPairList(dbPairs);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        backHref="/admin"
        title="Chat Permissions"
        subtitle="Control which role pairs can message each other"
      />

      <div className="rounded-2xl border border-stone-200 bg-white">
        <div className="border-b border-stone-100 px-5 py-3">
          <p className="text-xs text-stone-500">
            Each row is a bidirectional pair — enabling it lets both roles message each other.
            Management roles (admin, managing_officer, consultant) can message everyone by default.
          </p>
        </div>
        <div className="divide-y divide-stone-100">
          {pairs.map((pair) => (
            <div key={`${pair.role_a}:${pair.role_b}`} className="flex items-center justify-between px-5 py-3">
              <p className="text-sm text-stone-700">
                <span className="font-medium">{ROLE_LABELS[pair.role_a] ?? pair.role_a}</span>
                <span className="mx-2 text-stone-400">↔</span>
                <span className="font-medium">{ROLE_LABELS[pair.role_b] ?? pair.role_b}</span>
              </p>
              <ChatPermToggle
                roleA={pair.role_a}
                roleB={pair.role_b}
                enabled={pair.enabled}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
