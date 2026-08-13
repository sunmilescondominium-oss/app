"use client";

import { useState } from "react";
import { csvToObjects, buildTemplateCsv } from "@/lib/inventory/csv";
import { bulkImportUnits, type ImportResult } from "@/app/(app)/inventory/actions";
import type { UnitImportRow } from "@/lib/inventory/types";
import { BUSINESS_LINES, UNIT_STATUSES } from "@/lib/config";

const BL_KEYS: readonly string[] = BUSINESS_LINES.map((b) => b.key);
const STATUS_KEYS: readonly string[] = UNIT_STATUSES;

function otherIssue(r: Record<string, string>, resolvedBl: string): string | null {
  if (!(r.property || "").trim()) return "missing property";
  if (!(r.unit_number || "").trim()) return "missing unit_number";
  if (!resolvedBl) return "category not resolved";
  const st = (r.status || "").toLowerCase();
  if (st && !STATUS_KEYS.includes(st)) return `bad status "${r.status}"`;
  return null;
}

export function CsvImport({ onDone }: { onDone: () => void }) {
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  // key = raw CSV business_line value, value = valid BL key | "skip" | "" (unresolved)
  const [categoryMappings, setCategoryMappings] = useState<Record<string, string>>({});

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setParseError("");
    setResult(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await file.text();
      const { headers, rows: parsed } = csvToObjects(text);
      if (!headers.includes("property") || !headers.includes("unit_number")) {
        setParseError("CSV must include at least 'property' and 'unit_number' columns.");
        setRows([]);
        setCategoryMappings({});
        return;
      }
      setRows(parsed);

      // Collect every unrecognized business_line value
      const unknowns: Record<string, string> = {};
      for (const r of parsed) {
        const bl = (r.business_line || "").trim().toLowerCase();
        if (bl && !BL_KEYS.includes(bl) && !(bl in unknowns)) {
          unknowns[bl] = ""; // unresolved
        }
      }
      setCategoryMappings(unknowns);
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

  function setMapping(csvValue: string, target: string) {
    setCategoryMappings((m) => ({ ...m, [csvValue]: target }));
  }

  function resolveBlForRow(r: Record<string, string>): string {
    const raw = (r.business_line || "").trim().toLowerCase();
    if (BL_KEYS.includes(raw)) return raw;
    const mapped = categoryMappings[raw];
    return mapped && mapped !== "skip" ? mapped : "";
  }

  function isRowSkipped(r: Record<string, string>): boolean {
    const raw = (r.business_line || "").trim().toLowerCase();
    return categoryMappings[raw] === "skip";
  }

  const unknownValues = Object.keys(categoryMappings);
  const hasUnknowns = unknownValues.length > 0;
  const allResolved = unknownValues.every((k) => categoryMappings[k] !== "");

  const validCount = rows.filter((r) => {
    if (isRowSkipped(r)) return false;
    return otherIssue(r, resolveBlForRow(r)) === null;
  }).length;
  const skippedCount = rows.filter(isRowSkipped).length;
  const errorCount = rows.filter((r) => {
    if (isRowSkipped(r)) return false;
    return otherIssue(r, resolveBlForRow(r)) !== null;
  }).length;

  async function commit() {
    if (!allResolved) return;
    setPending(true);
    const toImport: UnitImportRow[] = rows
      .filter((r) => !isRowSkipped(r))
      .map((r) => ({
        ...r,
        business_line: resolveBlForRow(r),
      }) as UnitImportRow);
    const res = await bulkImportUnits(toImport);
    setResult(res);
    setPending(false);
  }

  if (result) {
    return (
      <div className="space-y-4">
        {result.ok ? (
          <>
            <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Imported {result.inserted} unit(s).
              {result.errors.length > 0 && ` ${result.errors.length} row(s) had issues.`}
            </p>
            {result.errors.length > 0 && (
              <div className="max-h-48 overflow-y-auto rounded-lg border border-stone-200 text-sm">
                {result.errors.map((e) => (
                  <div key={e.row} className="flex justify-between border-b border-stone-100 px-3 py-1.5 last:border-0">
                    <span className="text-stone-500">Row {e.row}</span>
                    <span className="text-red-600">{e.error}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{result.error}</p>
        )}
        <div className="flex justify-end">
          <button type="button" onClick={onDone} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* File picker + template */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
          Choose CSV…
          <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
        </label>
        <button type="button" onClick={downloadTemplate} className="text-sm font-medium text-amber-700 hover:underline">
          Download template
        </button>
        {fileName && <span className="text-sm text-stone-500">{fileName}</span>}
      </div>

      <p className="text-xs text-stone-500">
        Expected columns: property, unit_number, unit_type, floor, area_sqm, business_line, tcp, status.
        Valid categories: {BUSINESS_LINES.map((b) => b.key).join(", ")}.
      </p>

      {parseError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{parseError}</p>
      )}

      {/* ── Category mapping panel (shown when unknowns detected) ── */}
      {rows.length > 0 && hasUnknowns && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 space-y-3">
          <div className="flex items-start gap-2">
            <span className="text-amber-600 text-lg leading-none">⚠</span>
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {unknownValues.length} unrecognized categor{unknownValues.length === 1 ? "y" : "ies"} — action required
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                Map each CSV value to a valid category or choose "Skip" to exclude those rows.
                You cannot import until all are resolved.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {unknownValues.map((csvVal) => {
              const mapped = categoryMappings[csvVal];
              const affectedCount = rows.filter((r) => (r.business_line || "").trim().toLowerCase() === csvVal).length;
              return (
                <div key={csvVal} className="flex flex-wrap items-center gap-3 rounded-lg bg-white border border-amber-200 px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-xs font-semibold text-stone-700">{csvVal || "(blank)"}</span>
                    <span className="ml-2 text-xs text-stone-400">{affectedCount} row{affectedCount !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-400">Map to →</span>
                    <select
                      value={mapped}
                      onChange={(e) => setMapping(csvVal, e.target.value)}
                      className={`rounded-lg border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-amber-300 ${
                        mapped === ""
                          ? "border-red-300 bg-red-50 text-red-700"
                          : mapped === "skip"
                          ? "border-stone-300 bg-stone-100 text-stone-500"
                          : "border-emerald-300 bg-emerald-50 text-emerald-800"
                      }`}
                    >
                      <option value="">— choose action —</option>
                      {BUSINESS_LINES.map((b) => (
                        <option key={b.key} value={b.key}>{b.label} ({b.key})</option>
                      ))}
                      <option value="skip">Skip these rows</option>
                    </select>
                    {mapped === "" && (
                      <span className="text-xs font-semibold text-red-600">Required</span>
                    )}
                    {mapped === "skip" && (
                      <span className="text-xs text-stone-400">{affectedCount} row{affectedCount !== 1 ? "s" : ""} excluded</span>
                    )}
                    {mapped && mapped !== "skip" && (
                      <span className="text-xs font-semibold text-emerald-700">✓ Mapped</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {!allResolved && (
            <p className="text-xs font-medium text-red-600">
              Resolve all {unknownValues.filter((k) => categoryMappings[k] === "").length} unmapped categor{unknownValues.filter((k) => categoryMappings[k] === "").length === 1 ? "y" : "ies"} before importing.
            </p>
          )}
        </div>
      )}

      {/* Preview table */}
      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap gap-3 text-sm">
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-medium text-emerald-800">
              {validCount} ready
            </span>
            {skippedCount > 0 && (
              <span className="rounded-full bg-stone-100 px-2.5 py-0.5 font-medium text-stone-500">
                {skippedCount} skipped
              </span>
            )}
            {errorCount > 0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 font-medium text-red-700">
                {errorCount} with errors
              </span>
            )}
            {!allResolved && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-medium text-amber-700">
                {unknownValues.filter((k) => categoryMappings[k] === "").length} category unmapped — import blocked
              </span>
            )}
          </div>

          <div className="max-h-64 overflow-auto rounded-lg border border-stone-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-stone-50 text-xs uppercase text-stone-500">
                <tr>
                  <th className="px-3 py-2">Property</th>
                  <th className="px-3 py-2">Unit #</th>
                  <th className="px-3 py-2">CSV category</th>
                  <th className="px-3 py-2">Resolved</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Issue</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 200).map((r, i) => {
                  const skipped = isRowSkipped(r);
                  const resolved = resolveBlForRow(r);
                  const issue = skipped ? null : otherIssue(r, resolved);
                  const blLabel = BUSINESS_LINES.find((b) => b.key === resolved)?.label ?? "";
                  return (
                    <tr key={i} className={`border-t border-stone-100 ${skipped ? "opacity-40" : ""}`}>
                      <td className="px-3 py-1.5">{r.property}</td>
                      <td className="px-3 py-1.5">{r.unit_number}</td>
                      <td className="px-3 py-1.5 font-mono text-xs">{r.business_line || "(blank)"}</td>
                      <td className="px-3 py-1.5">
                        {skipped ? (
                          <span className="text-xs text-stone-400">skipped</span>
                        ) : resolved ? (
                          <span className="text-xs font-medium text-emerald-700">{blLabel}</span>
                        ) : (
                          <span className="text-xs text-amber-600">⚠ unmapped</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">{r.status || "available"}</td>
                      <td className="px-3 py-1.5 text-red-600 text-xs">{issue ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length > 200 && (
            <p className="text-xs text-stone-400">Showing first 200 of {rows.length} rows.</p>
          )}
        </>
      )}

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onDone} className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100">
          Cancel
        </button>
        <button
          type="button"
          onClick={commit}
          disabled={pending || rows.length === 0 || !allResolved}
          title={!allResolved ? "Resolve all category mappings before importing" : undefined}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {pending
            ? "Importing…"
            : !allResolved
            ? "Resolve categories to import"
            : `Import ${validCount} row${validCount !== 1 ? "s" : ""}${skippedCount > 0 ? ` (${skippedCount} skipped)` : ""}`}
        </button>
      </div>
    </div>
  );
}
