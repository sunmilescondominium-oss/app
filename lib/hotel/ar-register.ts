import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ARRegisterEntry {
  paymentId: string;
  paidAt: string;
  unitNumber: string | null;
  guestLabel: string;
  method: string;
  amount: number;
  arNo: string | null;
  orNo: string | null;
  voidedAsTest: boolean;
  stayId: string;
  edits: { oldArNo: string | null; newArNo: string | null; oldOrNo: string | null; newOrNo: string | null; reason: string; editedAt: string }[];
}

export async function listARRegister(date: string): Promise<ARRegisterEntry[]> {
  const admin = createAdminClient();
  const start = `${date}T00:00:00+08:00`;
  const end   = `${date}T23:59:59.999+08:00`;

  const { data: payments } = await admin
    .from("stay_payments")
    .select("id, ar_no, receipt_no, amount, method, paid_at, stay_id, stays(guest_label, voided_as_test, units:unit_id(unit_number))")
    .gte("paid_at", start)
    .lte("paid_at", end)
    .order("paid_at", { ascending: true });

  if (!payments?.length) return [];

  const paymentIds = payments.map((p) => p.id as string);
  const { data: edits } = await admin
    .from("hotel_ar_edits")
    .select("payment_id, old_ar_no, new_ar_no, old_or_no, new_or_no, reason, edited_at")
    .in("payment_id", paymentIds)
    .order("edited_at", { ascending: true });

  const editsByPayment = new Map<string, ARRegisterEntry["edits"]>();
  for (const e of edits ?? []) {
    const pid = e.payment_id as string;
    if (!editsByPayment.has(pid)) editsByPayment.set(pid, []);
    editsByPayment.get(pid)!.push({
      oldArNo: (e.old_ar_no as string | null) ?? null,
      newArNo: (e.new_ar_no as string | null) ?? null,
      oldOrNo: (e.old_or_no as string | null) ?? null,
      newOrNo: (e.new_or_no as string | null) ?? null,
      reason: e.reason as string,
      editedAt: e.edited_at as string,
    });
  }

  return payments.map((p) => {
    const stay = (p.stays && !Array.isArray(p.stays)) ? p.stays as { guest_label: string; voided_as_test: boolean; units: { unit_number: string } | null } : null;
    const unit = stay?.units;
    return {
      paymentId: p.id as string,
      paidAt: p.paid_at as string,
      unitNumber: unit?.unit_number ?? null,
      guestLabel: stay?.guest_label ?? "—",
      method: p.method as string,
      amount: Number(p.amount),
      arNo: (p.ar_no as string | null) ?? null,
      orNo: (p.receipt_no as string | null) ?? null,
      voidedAsTest: stay?.voided_as_test ?? false,
      stayId: p.stay_id as string,
      edits: editsByPayment.get(p.id as string) ?? [],
    };
  });
}
