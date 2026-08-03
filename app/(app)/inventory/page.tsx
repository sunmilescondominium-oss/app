import { requireModule } from "@/lib/auth/dal";
import { canWriteModule } from "@/lib/rbac/modules";
import { allowedBusinessLines } from "@/lib/rbac/inventory-scope";
import {
  listUnits,
  listProperties,
  inventorySummary,
  listFieldDefinitions,
} from "@/lib/inventory/queries";
import { BUSINESS_LINES, UNIT_STATUSES } from "@/lib/config";
import { PageHeader, Badge } from "@/components/ui";
import { InventoryTable } from "@/components/inventory/inventory-table";

export const metadata = { title: "Inventory" };

function statusLabel(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireModule("inventory");
  const canWrite = canWriteModule(user.roleKeys, "inventory");

  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  // Role-based scope: which business lines this user (or acted-as role) may see.
  const allowed = allowedBusinessLines(user.roleKeys);
  const scopeLines = allowed === "all" ? undefined : allowed;
  const lineOptions =
    allowed === "all" ? BUSINESS_LINES : BUSINESS_LINES.filter((b) => allowed.includes(b.key));

  const filters = {
    businessLine: pick("bl"),
    businessLines: scopeLines,
    status: pick("status"),
    propertyId: pick("property"),
    includeInactive: pick("inactive") === "1",
  };

  const [units, properties, summary, fieldDefs] = await Promise.all([
    listUnits(filters),
    listProperties(true),
    inventorySummary(scopeLines),
    listFieldDefinitions(),
  ]);

  const propOptions = properties.map((p) => ({ id: p.id, name: p.name }));
  const scopeLabel =
    allowed === "all" ? null : lineOptions.map((b) => b.label).join(", ");
  const canManageFields =
    user.roleKeys.includes("admin") || user.roleKeys.includes("managing_officer");

  const stats: { label: string; value: number }[] = [
    { label: "Total units", value: summary.total },
    { label: "Available", value: summary.byStatus.available },
    { label: "Occupied", value: summary.byStatus.occupied },
    { label: "Reserved", value: summary.byStatus.reserved },
    { label: "Maintenance", value: summary.byStatus.under_maintenance },
    { label: "Blocked", value: summary.byStatus.blocked },
  ];

  const selectCls =
    "rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200";

  return (
    <>
      <PageHeader
        backHref="/dashboard"
        title="Inventory"
        subtitle={
          scopeLabel
            ? `Property & unit / room registry — showing: ${scopeLabel}`
            : "Property & unit / room registry — all business lines"
        }
        badge={<Badge tone="green">Live</Badge>}
      />

      {/* Summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-stone-200 bg-white px-4 py-3"
          >
            <p className="text-2xl font-bold tabular-nums text-stone-900">
              {s.value}
            </p>
            <p className="text-xs text-stone-500">{s.label}</p>
          </div>
        ))}
      </div>
      {summary.inactive > 0 && (
        <p className="mb-4 text-xs text-stone-400">
          {summary.inactive} deactivated unit(s) hidden unless “include inactive”
          is on.
        </p>
      )}

      {/* Filters (native GET form — works without JS) */}
      <form
        method="get"
        className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-stone-200 bg-white p-4"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">
            Business line
          </label>
          <select name="bl" defaultValue={filters.businessLine ?? ""} className={selectCls}>
            <option value="">{scopeLabel ? "My lines" : "All lines"}</option>
            {lineOptions.map((b) => (
              <option key={b.key} value={b.key}>
                {b.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">
            Status
          </label>
          <select name="status" defaultValue={filters.status ?? ""} className={selectCls}>
            <option value="">All statuses</option>
            {UNIT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {statusLabel(s)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">
            Property
          </label>
          <select
            name="property"
            defaultValue={filters.propertyId ?? ""}
            className={selectCls}
          >
            <option value="">All properties</option>
            {propOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input
            type="checkbox"
            name="inactive"
            value="1"
            defaultChecked={filters.includeInactive}
            className="h-4 w-4 rounded border-stone-300"
          />
          Include inactive
        </label>
        <div className="flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-stone-800 px-4 py-2 text-sm font-medium text-white hover:bg-stone-900"
          >
            Apply
          </button>
          <a
            href="/inventory"
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >
            Reset
          </a>
        </div>
      </form>

      <InventoryTable
        units={units}
        properties={propOptions}
        fieldDefs={fieldDefs}
        canWrite={canWrite}
        canManageFields={canManageFields}
      />

      {!canWrite && (
        <p className="mt-4 text-xs text-stone-400">
          You have view-only access to inventory.
        </p>
      )}
    </>
  );
}
