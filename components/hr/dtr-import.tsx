"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { csvToObjects } from "@/lib/inventory/csv";
import { bulkImportDtr } from "@/app/(app)/hr/actions";
import { DTR_TEMPLATE, DTR_HEADERS, type DtrImportResult } from "@/lib/imports/dtr";

export function DtrImport({ canOverwrite }: { canOverwrite: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Record<string, string>[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<DtrImportResult | null>(null);

  function downloadTemplate() {
    const blob = new Blob([DTR_TEMPLATE], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dtr_template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name); setResult(null); setConfirm("");
    const reader = new FileReader();
    reader.onload = () => {
      const { headers, rows: parsed } = csvToObjects(String(reader.result));
      const missing = DTR_HEADERS.filter((h) => h !== "time_out" && !headers.includes(h));
      if (missing.length) { setErr(`Missing column(s): ${missing.join(", ")}. Use the template.`); setRows(null); return; }
      if (parsed.length === 0) { setErr("No data rows."); setRows(null); return; }
      setErr(""); setRows(parsed);
    };
    reader.readAsText(f);
    e.target.value = "";
  }

  async function run(overwrite: boolean) {
    if (!rows) return;
    setBusy(true);
    const res = await bulkImportDtr(rows, overwrite ? { overwrite: true, confirm, reason } : {});
    setBusy(false);
    setResult(res);
    if (res.ok && !res.needsOverwrite) { router.refresh(); }
    else if (res.ok && overwrite) { router.refresh(); }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100">
        ⬆⬇ Upload DTR / template
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-stone-800">Bulk DTR upload</p>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-stone-500 hover:underline">Close</button>
      </div>
      <ol className="mb-3 space-y-1 text-sm text-stone-600">
        <li>1. <button type="button" onClick={downloadTemplate} className="font-medium text-emerald-700 hover:underline">Download the template</button> and fill it in Google Sheets.</li>
        <li>2. Upload it here — new dates import directly.</li>
        <li>3. Rows that differ from an existing system punch are flagged for accounting/admin to overwrite.</li>
      </ol>

      <div className="flex flex-wrap items-center gap-2">
        <input ref={fileRef} type="file" accept=".csv,text/csv" hidden onChange={onFile} />
        <button type="button" onClick={() => fileRef.current?.click()} className="rounded-lg border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">Choose CSV…</button>
        {fileName && <span className="text-xs text-stone-500">{fileName}{rows ? ` · ${rows.length} row(s)` : ""}</span>}
        {rows && (
          <button type="button" onClick={() => run(false)} disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
            {busy ? "Importing…" : `Import ${rows.length} row(s)`}
          </button>
        )}
      </div>
      {err && <p className="mt-2 text-sm text-red-700">{err}</p>}

      {result && result.ok && (
        <div className="mt-3 space-y-2 text-sm">
          <p className="text-emerald-700">
            ✓ {result.inserted} added{result.overwritten ? ` · ${result.overwritten} overwritten` : ""} · {result.unchanged} unchanged
          </p>

          {result.invalid.length > 0 && (
            <details>
              <summary className="cursor-pointer text-rose-700">{result.invalid.length} invalid row(s) skipped</summary>
              <ul className="mt-1 max-h-40 overflow-y-auto text-xs text-stone-600">
                {result.invalid.map((e, i) => <li key={i}>Row {e.row}: {e.error}</li>)}
              </ul>
            </details>
          )}

          {result.needsOverwrite && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3">
              <p className="font-medium text-amber-900">{result.conflicts.length} row(s) differ from the system record</p>
              <ul className="mt-1 max-h-40 overflow-y-auto text-xs text-amber-800">
                {result.conflicts.map((e, i) => <li key={i}>Row {e.row}: {e.error}</li>)}
              </ul>
              {result.canOverwrite ? (
                <div className="mt-2 space-y-2">
                  <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for the correction (required — appears on the signed payroll)" className="w-full rounded-lg border border-amber-300 px-2 py-1.5 text-sm" />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-amber-900">Type <b>OVERWRITE</b> to apply (accounting/admin):</span>
                    <input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="OVERWRITE" className="w-32 rounded-lg border border-amber-300 px-2 py-1 text-sm" />
                    <button type="button" onClick={() => run(true)} disabled={busy || confirm.trim().toUpperCase() !== "OVERWRITE" || !reason.trim()} className="rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
                      Overwrite {result.conflicts.length} record(s)
                    </button>
                  </div>
                  <p className="text-[11px] text-amber-800">Corrections are applied now but flagged <b>pending owner/CEO approval</b> and printed on the payroll for sign-off.</p>
                </div>
              ) : (
                <p className="mt-2 text-xs text-amber-900">These conflict with existing punches — ask accounting/admin to review and overwrite.</p>
              )}
            </div>
          )}
        </div>
      )}
      {result && !result.ok && <p className="mt-2 text-sm text-red-700">{result.error}</p>}
    </div>
  );
}
