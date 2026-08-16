import Link from "next/link";
import { requireModule } from "@/lib/auth/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { BILLING_ITEM_TYPES, BUSINESS_LINES, BANK_BY_BUSINESS_LINE } from "@/lib/config";
import { PageHeader } from "@/components/ui";
import { RateCardManager } from "@/components/admin/rate-card-manager";

export const metadata = { title: "Rate Cards" };

async function listRateCards() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("unit_rate_cards")
    .select("*, units(unit_number, business_line, properties(name))")
    .order("item_key");
  return data ?? [];
}

async function listUnits() {
  const admin = createAdminClient();
  const { data } = await admin
    .from("units")
    .select("id, unit_number, business_line, properties(name)")
    .order("business_line")
    .order("unit_number");
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    unit_number: r.unit_number as string,
    business_line: r.business_line as string,
    properties: Array.isArray(r.properties)
      ? ((r.properties as Array<{ name: unknown }>)[0] ?? null)
        ? { name: String((r.properties as Array<{ name: unknown }>)[0].name) }
        : null
      : (r.properties as { name: string } | null),
  })) as Array<{
    id: string;
    unit_number: string;
    business_line: string;
    properties: { name: string } | null;
  }>;
}

const ITEM_LABEL = Object.fromEntries(BILLING_ITEM_TYPES.map((t) => [t.key, t.label]));
const BL_LABEL = Object.fromEntries(BUSINESS_LINES.map((b) => [b.key, b.label]));

export default async function RateCardsPage() {
  await requireModule("collections");

  const [cards, units] = await Promise.all([listRateCards(), listUnits()]);

  // Group cards by unit
  const byUnit = new Map<string, typeof cards>();
  for (const c of cards) {
    const uid = c.unit_id as string;
    if (!byUnit.has(uid)) byUnit.set(uid, []);
    byUnit.get(uid)!.push(c);
  }

  return (
    <>
      <div className="mb-4">
        <Link href="/admin" className="text-sm font-medium text-amber-700 hover:underline">
          ← Admin
        </Link>
      </div>

      <PageHeader
        title="Unit Rate Cards"
        subtitle="Configure monthly billing items per unit. Bank assignments follow the category."
      />

      {/* Bank assignment reference */}
      <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50/40 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-sky-800">
          Bank assignment by category
        </p>
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 text-xs">
          {Object.entries(BANK_BY_BUSINESS_LINE).map(([bl, bank]) => (
            <div key={bl} className="flex items-center gap-1.5">
              <span className="inline-block rounded bg-sky-100 px-1.5 py-0.5 font-mono text-sky-700">
                {BL_LABEL[bl] ?? bl}
              </span>
              <span className="text-stone-600">→ {bank}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-stone-400">
          To change bank assignments,{" "}
          <Link href="/admin/bank-config" className="font-medium text-amber-700 hover:underline">
            update Bank Deposit Config →
          </Link>
        </p>
      </div>

      {/* Rate card manager (add / generate bills) */}
      <RateCardManager units={units} itemTypes={BILLING_ITEM_TYPES as unknown as Array<{ key: string; label: string; lines: string[] }>} />

      {/* Existing rate cards grouped by unit */}
      {byUnit.size === 0 && (
        <div className="rounded-xl border border-stone-200 bg-stone-50 p-8 text-center text-sm text-stone-400">
          No rate cards configured yet. Add one above.
        </div>
      )}

      {Array.from(byUnit.entries()).map(([unitId, unitCards]) => {
        const first = unitCards[0] as Record<string, unknown>;
        const unit = (first.units as { unit_number: string; business_line: string; properties: { name: string } | null } | null);
        const label = unit
          ? `${unit.unit_number} — ${unit.properties?.name ?? ""}`.trim().replace(/— $/, "")
          : unitId;
        const bl = unit?.business_line ?? "";
        return (
          <div key={unitId} className="mb-4 rounded-xl border border-stone-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between border-b border-stone-100 bg-stone-50 px-4 py-2.5">
              <div>
                <p className="text-sm font-semibold text-stone-800">{label}</p>
                <p className="text-xs text-stone-500">
                  {BL_LABEL[bl] ?? bl}
                  {bl && BANK_BY_BUSINESS_LINE[bl] ? ` → ${BANK_BY_BUSINESS_LINE[bl]}` : ""}
                </p>
              </div>
            </div>
            <table className="w-full text-left text-sm">
              <thead className="border-b border-stone-100 text-xs uppercase tracking-wide text-stone-400">
                <tr>
                  <th className="px-4 py-2">Item</th>
                  <th className="px-4 py-2 text-right">Monthly Amount</th>
                  <th className="px-4 py-2">From</th>
                  <th className="px-4 py-2">Until</th>
                  <th className="px-4 py-2">Notes</th>
                </tr>
              </thead>
              <tbody>
                {unitCards.map((card) => {
                  const c = card as Record<string, unknown>;
                  return (
                    <tr key={c.id as string} className="border-t border-stone-50">
                      <td className="px-4 py-2 font-medium text-stone-700">
                        {ITEM_LABEL[c.item_key as string] ?? c.item_key as string}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        ₱{Number(c.monthly_amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2 text-stone-500">{c.effective_from as string}</td>
                      <td className="px-4 py-2 text-stone-500">{(c.effective_until as string | null) ?? "—"}</td>
                      <td className="px-4 py-2 text-stone-400 text-xs">{(c.notes as string | null) ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </>
  );
}
