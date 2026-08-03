export type AccountType = "collection" | "disbursement" | "payroll" | "general";
export type TxnDirection = "in" | "out";
export type TxnKind = "deposit" | "check" | "withdrawal" | "transfer" | "bank_charge" | "interest" | "adjustment";
export type TxnStatus = "pending" | "cleared" | "void";

export interface BankAccount {
  id: string;
  label: string;
  bank_name: string | null;
  account_no_masked: string | null;
  account_type: AccountType;
  opening_balance: number;
  is_active: boolean;
  sort_order: number;
  note: string | null;
}

/** Derived balances for an account. */
export interface AccountBalances {
  book: number;            // opening + all non-void (in − out): the running / available balance
  cleared: number;         // opening + cleared (in − out): reconciles to the bank statement
  depositsInTransit: number; // pending deposits (in, not yet cleared)
  outstandingChecks: number; // pending checks/withdrawals (out, not yet cleared)
}

export interface BankTransaction {
  id: string;
  bank_account_id: string;
  txn_date: string;
  direction: TxnDirection;
  amount: number;
  kind: TxnKind;
  reference: string | null;
  counterparty: string | null;
  memo: string | null;
  status: TxnStatus;
  cleared_on: string | null;
  transmittal_id: string | null;
}

export interface BankReconciliation {
  id: string;
  bank_account_id: string;
  statement_date: string;
  statement_balance: number;
  book_cleared_balance: number;
  difference: number;
  reconciled_by_role: string | null;
  note: string | null;
  created_at: string;
}

export const ACCOUNT_TYPE_LABEL: Record<AccountType, string> = {
  collection: "Collection",
  disbursement: "Disbursement",
  payroll: "Payroll",
  general: "General",
};

export const TXN_KIND_LABEL: Record<TxnKind, string> = {
  deposit: "Deposit",
  check: "Check released",
  withdrawal: "Withdrawal",
  transfer: "Transfer",
  bank_charge: "Bank charge",
  interest: "Interest",
  adjustment: "Adjustment",
};
