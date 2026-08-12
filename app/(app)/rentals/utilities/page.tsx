import { listUtilityUnits } from "@/lib/rentals/queries";
import { CsvImporter } from "@/components/data/csv-importer";
import { UtilityAccountForm } from "@/components/rentals/rental-forms";
import { importMeterReadings } from "@/app/(app)/rentals/actions";
import {
  METER_READING_HEADERS,
  METER_READING_TEMPLATE,
} from "@/lib/imports/config";
import type { MeterRow } from "@/lib/rentals/types";

function ReadingCell({ row, utility }: { row: MeterRow | null; utility: "electric" | "water" }) {
  if (!row) return <td className="px-3 py-2 text-stone-400 text-center text-sm">—</td>;
  const icon = utility === "electric" ? "⚡" : "💧";
  return (
    <td className="px-3 py-2 text-sm">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-stone-800">
          {icon} {row.reading.toLocaleString()} {utility === "electric" ? "kWh" : "m³"}
        </span>
        {row.consumption != null && (
          <span className="text-xs text-stone-500">+{row.consumption.toLocaleString()} consumed</span>
        )}
        {row.billAmount != null && (
          <span className="text-xs font-semibold text-amber-700">₱{row.billAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
        )}
        {row.dueDate && (
          <span className="text-xs text-rose-600">due {row.dueDate}</span>
        )}
        <span className="text-xs text-stone-400">{row.readOn}</span>
      </div>
    </td>
  );
}

export default async function UtilitiesPage() {
  const units = await listUtilityUnits();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-stone-900">Utility Monitoring</h1>
          <p className="mt-0.5 text-sm text-stone-500">
            Meralco &amp; water readings, account numbers, and billing per unit.
          </p>
        </div>
      </div>

      {/* CSV Import */}
      <CsvImporter
        title="Bulk import meter readings"
        label="Import readings"
        templateName="meter_readings_template.csv"
        templateCsv={METER_READING_TEMPLATE}
        requiredHeaders={[...METER_READING_HEADERS]}
        commit={importMeterReadings}
      />

      {/* Overview table */}
      <div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-stone-100 bg-stone-50 text-xs font-semibold uppercase tracking-wide text-stone-500">
            <tr>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Property</th>
              <th className="px-3 py-2">Meralco CAN</th>
              <th className="px-3 py-2">Water Acct.</th>
              <th className="px-3 py-2">Latest Electric</th>
              <th className="px-3 py-2">Latest Water</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {units.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-stone-400">
                  No units found.
                </td>
              </tr>
            )}
            {units.map((u) => (
              <tr key={u.unitId} className="hover:bg-stone-50">
                <td className="px-3 py-2 font-medium text-stone-900">{u.unitNumber}</td>
                <td className="px-3 py-2 text-stone-600">
                  <span>{u.propertyName}</span>
                  <span className="ml-1.5 inline-flex rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700">
                    {u.businessLine}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {u.meralcoCan ? (
                    <span className="font-mono text-xs text-stone-700">{u.meralcoCan}</span>
                  ) : (
                    <span className="text-stone-400">—</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {u.waterAccountNo ? (
                    <span className="font-mono text-xs text-stone-700">{u.waterAccountNo}</span>
                  ) : (
                    <span className="text-stone-400">—</span>
                  )}
                </td>
                <ReadingCell row={u.electric} utility="electric" />
                <ReadingCell row={u.water} utility="water" />
                <td className="px-3 py-2">
                  <UtilityAccountForm
                    unitId={u.unitId}
                    meralcoCan={u.meralcoCan}
                    waterAccountNo={u.waterAccountNo}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
