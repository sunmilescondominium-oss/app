import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { BANK_BY_BUSINESS_LINE } from "@/lib/config";

export interface RateCardItem {
  id: string;
  unit_id: string;
  item_key: string;
  label: string;
  monthly_amount: number;
  effective_from: string;
  effective_until: string | null;
  notes: string | null;
}

export interface UnitBill {
  id: string;
  unit_id: string;
  period_month: string;
  item_key: string;
  label: string;
  amount_billed: number;
  amount_paid: number;
  balance: number;
}

export interface BillSuggestion {
  item_key: string;
  label: string;
  current_amount: number;
  outstanding_balance: number;
  total_due: number;
  bill_id: string | null;
  period_month: string;
}

/** Returns the active rate card items for a unit (effective today). */
export async function getUnitRateCard(unitId: string): Promise<RateCardItem[]> {
  const admin = createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await admin
    .from("unit_rate_cards")
    .select("*")
    .eq("unit_id", unitId)
    .lte("effective_from", today)
    .or("effective_until.is.null,effective_until.gte." + today)
    .order("item_key");
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    unit_id: r.unit_id as string,
    item_key: r.item_key as string,
    label: r.label as string,
    monthly_amount: Number(r.monthly_amount),
    effective_from: r.effective_from as string,
    effective_until: (r.effective_until as string) ?? null,
    notes: (r.notes as string) ?? null,
  }));
}

/** Returns outstanding unit_bills (balance > 0) ordered oldest-first. */
export async function getUnitOutstandingBills(unitId: string): Promise<UnitBill[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("unit_bills")
    .select("*")
    .eq("unit_id", unitId)
    .order("period_month", { ascending: true });

  return (data ?? [])
    .map((r: Record<string, unknown>) => ({
      id: r.id as string,
      unit_id: r.unit_id as string,
      period_month: r.period_month as string,
      item_key: r.item_key as string,
      label: r.label as string,
      amount_billed: Number(r.amount_billed),
      amount_paid: Number(r.amount_paid),
      balance: Math.max(0, Number(r.amount_billed) - Number(r.amount_paid)),
    }))
    .filter((b) => b.balance > 0);
}

/**
 * Build the pre-filled bill suggestions for a unit+month.
 * Combines rate card (current month) + outstanding prior balances.
 */
export async function getUnitBillSuggestions(
  unitId: string,
  billingMonth: string, // 'YYYY-MM-01'
): Promise<BillSuggestion[]> {
  const admin = createAdminClient();

  const [rateCard, outstanding] = await Promise.all([
    getUnitRateCard(unitId),
    getUnitOutstandingBills(unitId),
  ]);

  // Get existing bills for the current month (may already be generated)
  const { data: currentBills } = await admin
    .from("unit_bills")
    .select("*")
    .eq("unit_id", unitId)
    .eq("period_month", billingMonth);

  const currentBillMap = new Map<string, Record<string, unknown>>(
    (currentBills ?? []).map((b: Record<string, unknown>) => [b.item_key as string, b]),
  );

  // Outstanding by item_key — accumulate prior months
  const priorBalance = new Map<string, { total: number; label: string }>();
  for (const b of outstanding) {
    if (b.period_month === billingMonth) continue; // skip current month
    const existing = priorBalance.get(b.item_key);
    if (existing) {
      existing.total += b.balance;
    } else {
      priorBalance.set(b.item_key, { total: b.balance, label: b.label });
    }
  }

  const suggestions: BillSuggestion[] = [];
  const seen = new Set<string>();

  for (const item of rateCard) {
    seen.add(item.item_key);
    const currentBill = currentBillMap.get(item.item_key);
    const currentAmount = currentBill
      ? Math.max(0, Number(currentBill.amount_billed) - Number(currentBill.amount_paid))
      : item.monthly_amount;
    const prior = priorBalance.get(item.item_key)?.total ?? 0;
    suggestions.push({
      item_key: item.item_key,
      label: item.label,
      current_amount: currentBill ? Math.max(0, Number(currentBill.amount_billed) - Number(currentBill.amount_paid)) : item.monthly_amount,
      outstanding_balance: prior,
      total_due: currentAmount + prior,
      bill_id: currentBill ? (currentBill.id as string) : null,
      period_month: billingMonth,
    });
  }

  // Also include outstanding items not on current rate card
  for (const [key, info] of priorBalance.entries()) {
    if (seen.has(key)) continue;
    suggestions.push({
      item_key: key,
      label: info.label,
      current_amount: 0,
      outstanding_balance: info.total,
      total_due: info.total,
      bill_id: null,
      period_month: billingMonth,
    });
  }

  return suggestions.filter((s) => s.total_due > 0);
}

/** Mark a bill as partially/fully paid (called after collection is saved). */
export async function payBill(
  billId: string,
  amountPaid: number,
): Promise<void> {
  const admin = createAdminClient();
  const { data: bill } = await admin
    .from("unit_bills")
    .select("amount_paid")
    .eq("id", billId)
    .maybeSingle();
  if (!bill) return;
  const newPaid = Number(bill.amount_paid) + amountPaid;
  await admin.from("unit_bills").update({ amount_paid: newPaid }).eq("id", billId);
}

/** Reverse a bill payment (called when a collection linked to a bill is deleted). */
export async function reverseBillPayment(
  billId: string,
  amountPaid: number,
): Promise<void> {
  const admin = createAdminClient();
  const { data: bill } = await admin
    .from("unit_bills")
    .select("amount_paid")
    .eq("id", billId)
    .maybeSingle();
  if (!bill) return;
  const newPaid = Math.max(0, Number(bill.amount_paid) - amountPaid);
  await admin.from("unit_bills").update({ amount_paid: newPaid }).eq("id", billId);
}

/** Upsert a unit_bill row (admin creates/updates the monthly charge). */
export async function upsertUnitBill(
  unitId: string,
  periodMonth: string,
  itemKey: string,
  label: string,
  amountBilled: number,
  notes: string | null,
  createdBy: string,
): Promise<UnitBill> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("unit_bills")
    .upsert(
      { unit_id: unitId, period_month: periodMonth, item_key: itemKey, label, amount_billed: amountBilled, notes, created_by: createdBy },
      { onConflict: "unit_id,period_month,item_key" },
    )
    .select()
    .single();
  if (error) throw new Error(error.message);
  const r = data as Record<string, unknown>;
  return {
    id: r.id as string,
    unit_id: r.unit_id as string,
    period_month: r.period_month as string,
    item_key: r.item_key as string,
    label: r.label as string,
    amount_billed: Number(r.amount_billed),
    amount_paid: Number(r.amount_paid),
    balance: Math.max(0, Number(r.amount_billed) - Number(r.amount_paid)),
  };
}

/** Returns the bank account for a given business_line. */
export function bankForLine(businessLine: string): string {
  return BANK_BY_BUSINESS_LINE[businessLine] ?? BANK_BY_BUSINESS_LINE["other"] ?? "General";
}
