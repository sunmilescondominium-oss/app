export interface SalesRow {
  line: string;
  label: string;
  gross: number;
}

export interface SalesReport {
  from: string;
  to: string;
  rows: SalesRow[];
  grossTotal: number;
  net: number;
  vat: number;
  vatLabel: string;
  vatMode: string;
}

export interface PLRow {
  line: string;
  label: string;
  income: number;
  expense: number;
  net: number;
}

export interface PLReport {
  rows: PLRow[];
  incomeTotal: number;
  expenseTotal: number;
  netTotal: number;
}

export interface MonthPoint {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export interface Expense {
  id: string;
  business_line: string;
  category: string;
  amount: number;
  expense_date: string;
  vendor: string | null;
  or_number: string | null;
  remarks: string | null;
}

export interface FinanceSettings {
  vat_mode: string;
  vat_rate: number;
}

export interface PLRowWithComparison extends PLRow {
  margin: number;
  priorIncome: number;
  priorExpense: number;
  priorNet: number;
  deltaNet: number;
  deltaNetPct: number | null;
}

export interface PLReportFull {
  rows: PLRowWithComparison[];
  incomeTotal: number;
  expenseTotal: number;
  netTotal: number;
  margin: number;
  priorIncomeTotal: number;
  priorExpenseTotal: number;
  priorNetTotal: number;
  deltaNet: number;
  deltaNetPct: number | null;
  hasPrior: boolean;
}

export interface ExpenseByCategory {
  category: string;
  total: number;
  count: number;
  pct: number;
}
