"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { csvToObjects } from "@/lib/inventory/csv";
import type { ImportResult } from "@/lib/imports/types";

export type { ImportResult };

/**
 * Reusable CSV import/template panel. Pass the required headers, a ready-made
 * template string, and a server action that validates + inserts the rows.
 *   1. Download template  2. Upload a filled CSV  3. Review  4. Commit.
 */
export function CsvImporter({
  title,
  label,
  templateName,
  templateCsv,
  requiredHeaders,
  commit,
}: {
  title: string;
  label?: string;
  templateName: string;
  templateCsv: string;
  requiredHeaders: string[];
  commit: (rows: Record<string, string>[]) => Promise<ImportResult>;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [err, setErr] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);

  function downloadTemplate() {
    const blob = new Blob([templateCsv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = templateName;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = () => {
      const { headers, rows: parsed } = csvToObjects(String(reader.result));
      const missing = requiredHeaders.filter((h) => !headers.includes(h));
      if (missing.length) { setErr(`Missing required column(s): ${missing.join(", ")}. Use the template.`); setRows(null); return; }
      if (parsed.length === 0) { setErr("The file has no data rows."); setRows(null); return; }
      setErr("");
      setRows(parsed);
    };
    reader.readAsText(f);
    e.target.value = "";
  }

  async function doCommit() {
    if (!rows) return;
    setBusy(true);
    const res = await commit(rows);
    setBusy(false);
    setResult(res);
    if (res.ok) { setRows(null); setFileName(""); router.refresh(); }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100">
        ⬆⬇ {label ?? "Import / template"}
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-800">{title}</p>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-stone-500 hover:underline">Close</button>
      </div>

      <ol className="mb-3 space-y-1 text-sm text-stone-600">
        <li>1. <button type="button" onClick={downloadTemplate} className="font-medium text-emerald-700 hover:underline">Download the CSV template</button> and fill it in Google Sheets.</li>
        <li>2. Export from Sheets as CSV, then upload it here.</li>
        <li>3. Review and commit — invalid rows are skipped with a reason.</li>
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onFile} />
        <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">Choose CSV…</button>
        {fileName && <span className="text-xs text-stone-500">{fileName}{rows ? ` · ${rows.length} row(s)` : ""}</span>}
        {rows && (
          <button type="button" onClick={doCommit} disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
            {busy ? "Importing…" : `Import ${rows.length} row(s)`}
          </button>
        )}
      </div>

      {err && <p className="mt-2 text-sm text-red-700">{err}</p>}

      {result && result.ok && (
        <div className="mt-2 text-sm">
          <p className="text-emerald-700">✓ Imported {result.inserted} row(s).</p>
          {result.errors && result.errors.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer text-rose-700">{result.errors.length} row(s) skipped</summary>
              <ul className="mt-1 max-h-40 overflow-y-auto text-xs text-stone-600">
                {result.errors.map((e, i) => <li key={i}>Row {e.row}: {e.error}</li>)}
              </ul>
            </details>
          )}
        </div>
      )}
      {result && !result.ok && <p className="mt-2 text-sm text-red-700">{result.error}</p>}
    </div>
  );
}
