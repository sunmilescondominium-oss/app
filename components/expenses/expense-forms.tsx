"use client";

import { useState, useTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  saveExpenseCategory,
  saveExpenseVendor,
  saveExpenseSettings,
  recordExpense,
  importExpensesFromCsv,
  type CsvImportRow,
} from "@/lib/expenses/actions";
import type { ExpenseCategory, ExpenseVendor, ExpenseSettings, CsvExpenseRow } from "@/lib/expenses/queries";
import { CSV_TEMPLATE_FIELDS } from "@/lib/expenses/constants";

type AR = { ok: true } | { ok: false; error: string } | undefined;

// ---------------------------------------------------------------------------
// Record Expense Form
// ---------------------------------------------------------------------------

export function RecordExpenseForm({
  categories,
  vendors,
  accounts,
  settings,
}: {
  categories: ExpenseCategory[];
  vendors: ExpenseVendor[];
  accounts: { id: string; label: string }[];
  settings: ExpenseSettings;
}) {
  const [state, action, pending] = useActionState<AR, FormData>(recordExpense, undefined);
  const [source, setSource] = useState<"bank" | "petty_cash">("bank");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Manila" }).format(new Date());

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Date *</label>
        <input type="date" name="expense_date" defaultValue={today} required className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Amount (₱) *</label>
        <input type="number" name="amount" min="0.01" step="0.01" required placeholder="0.00" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm tabular-nums" />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-stone-600">Description *</label>
        <input type="text" name="description" required placeholder="What was purchased or paid for?" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Category</label>
        <select name="expense_category_id" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm">
          <option value="">— choose —</option>
          {categories.filter((c) => c.is_active).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Vendor / Payee</label>
        <select name="expense_vendor_id" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm">
          <option value="">— choose —</option>
          {vendors.filter((v) => v.is_active).map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Source *</label>
        <select
          name="source"
          value={source}
          onChange={(e) => setSource(e.target.value as "bank" | "petty_cash")}
          className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
        >
          <option value="bank">Bank account</option>
          <option value="petty_cash">Petty cash</option>
        </select>
      </div>
      {source === "bank" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-stone-600">Bank account *</label>
          <select name="bank_account_id" required className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm">
            <option value="">— select account —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.label}</option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">OR / Receipt number</label>
        <input type="text" name="or_number" placeholder="e.g. 1234" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-xs font-medium text-stone-600">Remarks</label>
        <input type="text" name="remarks" placeholder="Optional notes" className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
      </div>
      {settings.approval_threshold > 0 && (
        <p className="sm:col-span-2 text-xs text-amber-700">
          Expenses ₱{settings.approval_threshold.toLocaleString()} and above will require approval.
        </p>
      )}
      {state && !state.ok && <p className="sm:col-span-2 text-sm text-rose-600">{state.error}</p>}
      {state?.ok && <p className="sm:col-span-2 text-sm text-emerald-600">Expense recorded.</p>}
      <div className="sm:col-span-2">
        <button disabled={pending} className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50">
          {pending ? "Saving…" : "Record expense"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Category Form
// ---------------------------------------------------------------------------

export function CategoryForm({ category }: { category?: ExpenseCategory }) {
  const [state, action, pending] = useActionState<AR, FormData>(saveExpenseCategory, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      {category && <input type="hidden" name="id" value={category.id} />}
      <div className="flex-1 min-w-[160px]">
        <label className="mb-1 block text-xs font-medium text-stone-600">Name *</label>
        <input type="text" name="name" defaultValue={category?.name} required className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
      </div>
      <div className="flex-[2] min-w-[200px]">
        <label className="mb-1 block text-xs font-medium text-stone-600">Description</label>
        <input type="text" name="description" defaultValue={category?.description ?? ""} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Order</label>
        <input type="number" name="sort_order" defaultValue={category?.sort_order ?? 100} className="w-24 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm tabular-nums" />
      </div>
      {category && (
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" name="is_active" value="true" defaultChecked={category.is_active} className="accent-emerald-600" />
          Active
        </label>
      )}
      {state && !state.ok && <p className="w-full text-xs text-rose-600">{state.error}</p>}
      {state?.ok && <p className="w-full text-xs text-emerald-600">Saved.</p>}
      <button disabled={pending} className="rounded-xl bg-stone-800 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-50">
        {pending ? "Saving…" : category ? "Update" : "Add category"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Vendor Form
// ---------------------------------------------------------------------------

export function VendorForm({ vendor }: { vendor?: ExpenseVendor }) {
  const [state, action, pending] = useActionState<AR, FormData>(saveExpenseVendor, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      {vendor && <input type="hidden" name="id" value={vendor.id} />}
      <div className="flex-1 min-w-[160px]">
        <label className="mb-1 block text-xs font-medium text-stone-600">Name *</label>
        <input type="text" name="name" defaultValue={vendor?.name} required className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
      </div>
      <div className="flex-1 min-w-[160px]">
        <label className="mb-1 block text-xs font-medium text-stone-600">Contact</label>
        <input type="text" name="contact" defaultValue={vendor?.contact ?? ""} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
      </div>
      <div className="w-36">
        <label className="mb-1 block text-xs font-medium text-stone-600">TIN</label>
        <input type="text" name="tin" defaultValue={vendor?.tin ?? ""} className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm" />
      </div>
      {state && !state.ok && <p className="w-full text-xs text-rose-600">{state.error}</p>}
      {state?.ok && <p className="w-full text-xs text-emerald-600">Saved.</p>}
      <button disabled={pending} className="rounded-xl bg-stone-800 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-50">
        {pending ? "Saving…" : vendor ? "Update" : "Add vendor"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Settings Form
// ---------------------------------------------------------------------------

export function ExpenseSettingsForm({ settings }: { settings: ExpenseSettings }) {
  const [state, action, pending] = useActionState<AR, FormData>(saveExpenseSettings, undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Approval threshold (₱)</label>
        <input type="number" name="approval_threshold" defaultValue={settings.approval_threshold} min="0" step="100" className="w-40 rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm tabular-nums" />
        <p className="mt-1 text-xs text-stone-400">Expenses at or above this amount require approval before being counted in P&L.</p>
      </div>
      {state && !state.ok && <p className="w-full text-xs text-rose-600">{state.error}</p>}
      {state?.ok && <p className="w-full text-xs text-emerald-600">Settings saved.</p>}
      <button disabled={pending} className="self-start mt-6 rounded-xl bg-stone-800 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-50">
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// CSV Import
// ---------------------------------------------------------------------------

export function CsvImportPanel({
  categories,
  vendors,
  accounts,
}: {
  categories: ExpenseCategory[];
  vendors: ExpenseVendor[];
  accounts: { id: string; label: string }[];
}) {
  const [rows, setRows] = useState<CsvImportRow[] | null>(null);
  const [parseErr, setParseErr] = useState<string | null>(null);
  const [importing, startImport] = useTransition();
  const [result, setResult] = useState<string | null>(null);
  const router = useRouter();

  function parseFile(file: File) {
    setParseErr(null);
    setRows(null);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) { setParseErr("File is empty or has no data rows."); return; }
        const parsed: CsvImportRow[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
          if (cols.length < 4) continue;
          const amount = parseFloat(cols[3]);
          if (isNaN(amount)) { setParseErr(`Row ${i + 1}: Amount "${cols[3]}" is not a number.`); return; }
          parsed.push({
            expense_date: cols[0],
            category_name: cols[1],
            vendor_name: cols[2],
            amount,
            or_number: cols[4] || null,
            source: cols[5] || "import",
            bank_account_label: cols[6] || null,
            remarks: cols[7] || null,
          });
        }
        setRows(parsed);
      } catch {
        setParseErr("Could not parse file. Check that it is a valid CSV.");
      }
    };
    reader.readAsText(file);
  }

  function doImport() {
    if (!rows) return;
    startImport(async () => {
      const r = await importExpensesFromCsv(rows);
      if (!r.ok) { setResult(`Error: ${r.error}`); return; }
      setResult(`Successfully imported ${(r as { ok: true; imported?: number }).imported ?? rows.length} expenses.`);
      setRows(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
        <p className="mb-2 text-xs font-semibold text-stone-600 uppercase tracking-wide">Required CSV columns</p>
        <div className="overflow-x-auto">
          <table className="text-xs text-left text-stone-600">
            <thead><tr>{CSV_TEMPLATE_FIELDS.map((f) => <th key={f.key} className="pr-6 pb-1 font-semibold text-stone-800">{f.key}</th>)}</tr></thead>
            <tbody><tr>{CSV_TEMPLATE_FIELDS.map((f) => <td key={f.key} className="pr-6">{f.note}</td>)}</tr></tbody>
          </table>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-stone-600">Upload CSV file</label>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) parseFile(f); }}
          className="text-sm text-stone-700"
        />
      </div>

      {parseErr && <p className="text-sm text-rose-600">{parseErr}</p>}

      {rows && rows.length > 0 && (
        <div>
          <p className="mb-2 text-sm text-stone-700 font-medium">{rows.length} rows ready to import</p>
          <div className="overflow-x-auto max-h-64 rounded-xl border border-stone-200">
            <table className="w-full text-xs text-left">
              <thead className="bg-stone-50 text-stone-500 uppercase">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Vendor</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2">Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 50).map((r, i) => (
                  <tr key={i} className="border-t border-stone-100">
                    <td className="px-3 py-1.5">{r.expense_date}</td>
                    <td className="px-3 py-1.5">{r.category_name}</td>
                    <td className="px-3 py-1.5">{r.vendor_name}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">₱{r.amount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-1.5">{r.source}</td>
                  </tr>
                ))}
                {rows.length > 50 && <tr><td colSpan={5} className="px-3 py-2 text-stone-400">… and {rows.length - 50} more rows</td></tr>}
              </tbody>
            </table>
          </div>
          <button
            disabled={importing}
            onClick={doImport}
            className="mt-3 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {importing ? "Importing…" : `Import ${rows.length} rows`}
          </button>
        </div>
      )}

      {result && (
        <p className={`text-sm font-medium ${result.startsWith("Error") ? "text-rose-600" : "text-emerald-600"}`}>{result}</p>
      )}
    </div>
  );
}
