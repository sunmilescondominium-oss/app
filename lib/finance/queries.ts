import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { COLLECTION_CATEGORIES } from "@/lib/config";
import { computeTax } from "@/lib/hotel/tax";
import type {
  SalesReport,
  PLReport,
  PLRow,
  MonthPoint,
  Expense,
  FinanceSettings,
} from "./types";

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function getFinanceSettings(): Promise<FinanceSettings> {
  const admin = createAdminClient();
  const { data } = await admin.from("finance_settings").select("vat_mode, vat_rate").eq("id", 1).maybeSingle();
  return { vat_mode: (data?.vat_mode as string) ?? "none", vat_rate: Number(data?.vat_rate ?? 0) };
}

export async function salesReport(from: string, to: string): Promise<SalesReport> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("collections")
    .select("business_line, amount")
    .gte("collected_on", from)
    .lte("collected_on", to);

  const byLine = new Map<string, number>();
  for (const c of (data ?? []) as { business_line: string; amount: number }[]) {
    byLine.set(c.business_line, (byLine.get(c.business_line) ?? 0) + Number(c.amount));
  }
  const rows = COLLECTION_CATEGORIES.map((c) => ({
    line: c.key,
    label: c.label,
    gross: r2(byLine.get(c.key) ?? 0),
  })).filter((r) => r.gross > 0);
  const grossTotal = r2([...byLine.values()].reduce((s, v) => s + v, 0));

  const settings = await getFinanceSettings();
  const tax = computeTax(grossTotal, settings.vat_mode, settings.vat_rate);
  return { from, to, rows, grossTotal, net: tax.net, vat: tax.tax, vatLabel: tax.label, vatMode: settings.vat_mode };
}

export async function plReport(from: string, to: string): Promise<PLReport> {
  const admin = createAdminClient();
  const [{ data: cols }, { data: exps }] = await Promise.all([
    admin.from("collections").select("business_line, amount").gte("collected_on", from).lte("collected_on", to),
    admin.from("expenses").select("business_line, amount").gte("expense_date", from).lte("expense_date", to),
  ]);

  const inc = new Map<string, number>();
  const exp = new Map<string, number>();
  for (const c of (cols ?? []) as { business_line: string; amount: number }[]) inc.set(c.business_line, (inc.get(c.business_line) ?? 0) + Number(c.amount));
  for (const e of (exps ?? []) as { business_line: string; amount: number }[]) exp.set(e.business_line, (exp.get(e.business_line) ?? 0) + Number(e.amount));

  const rows: PLRow[] = COLLECTION_CATEGORIES.map((c) => {
    const income = r2(inc.get(c.key) ?? 0);
    const expense = r2(exp.get(c.key) ?? 0);
    return { line: c.key, label: c.label, income, expense, net: r2(income - expense) };
  }).filter((r) => r.income !== 0 || r.expense !== 0);

  const incomeTotal = r2(rows.reduce((s, r) => s + r.income, 0));
  const expenseTotal = r2(rows.reduce((s, r) => s + r.expense, 0));
  return { rows, incomeTotal, expenseTotal, netTotal: r2(incomeTotal - expenseTotal) };
}

export async function monthlyCompare(months = 6): Promise<MonthPoint[]> {
  const admin = createAdminClient();
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1)).toISOString().slice(0, 10);

  const [{ data: cols }, { data: exps }] = await Promise.all([
    admin.from("collections").select("collected_on, amount").gte("collected_on", start),
    admin.from("expenses").select("expense_date, amount").gte("expense_date", start),
  ]);

  const inc = new Map<string, number>();
  const exp = new Map<string, number>();
  for (const c of (cols ?? []) as { collected_on: string; amount: number }[]) {
    const m = c.collected_on.slice(0, 7);
    inc.set(m, (inc.get(m) ?? 0) + Number(c.amount));
  }
  for (const e of (exps ?? []) as { expense_date: string; amount: number }[]) {
    const m = e.expense_date.slice(0, 7);
    exp.set(m, (exp.get(m) ?? 0) + Number(e.amount));
  }

  const out: MonthPoint[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const m = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7);
    const income = r2(inc.get(m) ?? 0);
    const expense = r2(exp.get(m) ?? 0);
    out.push({ month: m, income, expense, net: r2(income - expense) });
  }
  return out;
}

export async function listExpenses(from: string, to: string): Promise<Expense[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("expenses")
    .select("*")
    .gte("expense_date", from)
    .lte("expense_date", to)
    .order("expense_date", { ascending: false });
  return (data ?? []).map((e: Record<string, unknown>) => ({
    id: e.id as string,
    business_line: e.business_line as string,
    category: e.category as string,
    amount: Number(e.amount),
    expense_date: e.expense_date as string,
    vendor: (e.vendor as string) ?? null,
    or_number: (e.or_number as string) ?? null,
    remarks: (e.remarks as string) ?? null,
  }));
}
