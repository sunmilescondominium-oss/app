import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  BankAccount,
  AccountBalances,
  BankTransaction,
  BankReconciliation,
} from "./types";

function mapAccount(r: Record<string, unknown>): BankAccount {
  return {
    id: r.id as string,
    label: r.label as string,
    bank_name: (r.bank_name as string) ?? null,
    account_no_masked: (r.account_no_masked as string) ?? null,
    account_type: r.account_type as BankAccount["account_type"],
    opening_balance: Number(r.opening_balance),
    is_active: r.is_active as boolean,
    sort_order: Number(r.sort_order),
    note: (r.note as string) ?? null,
  };
}

function mapTxn(r: Record<string, unknown>): BankTransaction {
  return {
    id: r.id as string,
    bank_account_id: r.bank_account_id as string,
    txn_date: r.txn_date as string,
    direction: r.direction as BankTransaction["direction"],
    amount: Number(r.amount),
    kind: r.kind as BankTransaction["kind"],
    reference: (r.reference as string) ?? null,
    counterparty: (r.counterparty as string) ?? null,
    memo: (r.memo as string) ?? null,
    status: r.status as BankTransaction["status"],
    cleared_on: (r.cleared_on as string) ?? null,
    transmittal_id: (r.transmittal_id as string) ?? null,
  };
}

/** Fold a set of transactions into an account's derived balances. */
export function foldBalances(opening: number, txns: BankTransaction[]): AccountBalances {
  let book = opening;
  let cleared = opening;
  let depositsInTransit = 0;
  let outstandingChecks = 0;
  for (const t of txns) {
    if (t.status === "void") continue;
    const signed = t.direction === "in" ? t.amount : -t.amount;
    book += signed;
    if (t.status === "cleared") {
      cleared += signed;
    } else {
      // pending
      if (t.direction === "in") depositsInTransit += t.amount;
      else outstandingChecks += t.amount;
    }
  }
  return { book, cleared, depositsInTransit, outstandingChecks };
}

export interface AccountWithBalances {
  account: BankAccount;
  balances: AccountBalances;
}

/** All accounts with their derived balances (one ledger scan). */
export async function listAccountsWithBalances(): Promise<AccountWithBalances[]> {
  const supabase = await createClient();
  const [{ data: accts }, { data: txns }] = await Promise.all([
    supabase.from("bank_accounts").select("*").order("sort_order", { ascending: true }),
    supabase.from("bank_transactions").select("*").neq("status", "void"),
  ]);
  const byAccount = new Map<string, BankTransaction[]>();
  for (const row of txns ?? []) {
    const t = mapTxn(row);
    (byAccount.get(t.bank_account_id) ?? byAccount.set(t.bank_account_id, []).get(t.bank_account_id)!).push(t);
  }
  return (accts ?? []).map((r) => {
    const account = mapAccount(r);
    return { account, balances: foldBalances(account.opening_balance, byAccount.get(account.id) ?? []) };
  });
}

/** Lightweight active-account options for pickers. */
export async function listAccountOptions(): Promise<{ id: string; label: string }[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bank_accounts")
    .select("id, label")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  return (data ?? []).map((r) => ({ id: r.id as string, label: r.label as string }));
}

export async function getAccount(id: string): Promise<BankAccount | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("bank_accounts").select("*").eq("id", id).maybeSingle();
  return data ? mapAccount(data) : null;
}

export async function listTransactions(accountId: string, limit = 200): Promise<BankTransaction[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bank_transactions")
    .select("*")
    .eq("bank_account_id", accountId)
    .order("txn_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map(mapTxn);
}

/** Full ledger (all statuses) folded into balances for one account. */
export async function accountBalances(accountId: string, opening: number): Promise<AccountBalances> {
  const supabase = await createClient();
  const { data } = await supabase.from("bank_transactions").select("*").eq("bank_account_id", accountId).neq("status", "void");
  return foldBalances(opening, (data ?? []).map(mapTxn));
}

export async function listReconciliations(accountId: string, limit = 12): Promise<BankReconciliation[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("bank_reconciliations")
    .select("*")
    .eq("bank_account_id", accountId)
    .order("statement_date", { ascending: false })
    .limit(limit);
  return (data ?? []).map((r) => ({
    id: r.id as string,
    bank_account_id: r.bank_account_id as string,
    statement_date: r.statement_date as string,
    statement_balance: Number(r.statement_balance),
    book_cleared_balance: Number(r.book_cleared_balance),
    difference: Number(r.difference),
    reconciled_by_role: (r.reconciled_by_role as string) ?? null,
    note: (r.note as string) ?? null,
    created_at: r.created_at as string,
  }));
}
