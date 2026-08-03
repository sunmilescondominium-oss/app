"use client";

import { useState } from "react";
import { csvToObjects, buildTemplateCsv } from "@/lib/inventory/csv";
import { bulkImportUnits, type ImportResult } from "@/app/(app)/inventory/actions";
import type { UnitImportRow } from "@/lib/inventory/types";
import { BUSINESS_LINES, UNIT_STATUSES } from "@/lib/config";

const BL_KEYS: readonly string[] = BUSINESS_LINES.map((b) => b.key);
const STATUS_KEYS: readonly string[] = UNIT_STATUSES;

function rowIssue(r: Record<string, string>): string | null {
  if (!(r.property || "").trim()) return "missing property";
  if (!(r.unit_number || "").trim()) return "missing unit_number";
  if (!BL_KEYS.includes((r.business_line || "").toLowerCase()))
    return "bad business_line";
  const st = (r.status || "").toLowerCase();
  if (st && !STATUS_KEYS.includes(st)) return "bad status";
  return null;
}

export function CsvImport({ onDone }: { onDone: () => void }) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setParseError("");
    setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const { headers, rows } = csvToObjects(text);
      if (!headers.includes("property") || !headers.includes("unit_number")) {
        setParseError(
          "CSV must include at least 'property' and 'unit_number' columns.",
        );
        setRows([]);
        return;
      }
      setRows(rows);
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Could not read file.");
    }
  }

  function downloadTemplate() {
    const blob = new Blob([buildTemplateCsv()], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory_template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function commit() {
    setPending(true);
    const res = await bulkImportUnits(rows as UnitImportRow[]);
    setResult(res);
    setPending(false);
  }

  const validCount = rows.filter((r) => rowIssue(r) === null).length;
  const invalidCount = rows.length - validCount;

  if (result) {
    return (
      <div className="space-y-4">
        {result.ok ? (
          <>
            <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Imported {result.inserted} unit(s).
              {result.errors.length > 0 &&
                ` ${result.errors.length} row(s) skipped.`}
            </p>
            {result.errors.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-stone-200 text-sm">
                {result.errors.map((e) => (
                  <div
                    key={e.row}
                    className="flex justify-between border-b border-stone-100 px-3 py-1.5 last:border-0"
                  >
                    <span className="text-stone-500">Row {e.row}</span>
                    <span className="text-red-600">{e.error}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            {result.error}
          </p>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onDone}
            className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
          Choose CSV…
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
        </label>
        <button
          type="button"
          onClick={downloadTemplate}
          className="text-sm font-medium text-amber-700 hover:underline"
        >
          Download template
        </button>
        {fileName && <span className="text-sm text-stone-500">{fileName}</span>}
      </div>

      <p className="text-xs text-stone-500">
        Expected columns: property, unit_number, unit_type, floor, area_sqm,
        business_line, tcp, status. Existing properties are matched by name; new
        ones are created. Re-importing updates a unit with the same number.
      </p>

      {parseError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {parseError}
        </p>
      )}

      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-medium text-emerald-800">
              {validCount} ready
            </span>
            {invalidCount > 0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 font-medium text-red-700">
                {invalidCount} with issues
              </span>
            )}
          </div>

          <div className="max-h-64 overflow-auto rounded-lg border border-stone-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-stone-50 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-3 py-2">Property</th>
                  <th className="px-3 py-2">Unit #</th>
                  <th className="px-3 py-2">Line</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Issue</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r, i) => {
                  const issue = rowIssue(r);
                  return (
                    <tr key={i} className="border-t border-stone-100">
                      <td className="px-3 py-1.5">{r.property}</td>
                      <td className="px-3 py-1.5">{r.unit_number}</td>
                      <td className="px-3 py-1.5">{r.business_line}</td>
                      <td className="px-3 py-1.5">{r.status || "available"}</td>
                      <td className="px-3 py-1.5 text-red-600">{issue ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length > 200 && (
            <p className="text-xs text-stone-400">
              Showing first 200 of {rows.length} rows. All will be imported.
            </p>
          )}
        </>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={commit}
          disabled={pending || rows.length === 0}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {pending ? "Importing…" : `Import ${rows.length} row(s)`}
        </button>
      </div>
    </div>
  );
}
