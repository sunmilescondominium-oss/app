"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SOAResult } from "@/lib/computation/types";

/**
 * Public buyer lookup by unit number + reference PIN. No Supabase Auth — served
 * via the service role in this server action, guarded by the PIN + a best-effort
 * rate limit. Returns ONLY a public-safe subset and never another buyer's rows.
 */
export interface PortalResult {
  contact_label: string;
  unit_number: string;
  status: string;
  contract_balance: number | null;
  amount_due_now: number | null;
  next_due_date: string | null;
  payments: { paid_on: string; doc_type: string; or_number: string | null; amount: number }[];
  /** Condo association dues for the owner's unit (unpaid first). */
  condo_dues: { category: string; amount: number; due_date: string | null; status: string }[];
  condo_dues_total: number;
}

export type PortalState =
  | { ok: true; data: PortalResult }
  | { ok: false; error: string }
  | undefined;

// Best-effort in-memory limiter. TODO(client-confirm): move to Upstash/DB for
// production (serverless instances don't share this map).
const WINDOW_MS = 60_000;
const MAX_HITS = 8;
const hits = new Map<string, { count: number; ts: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || now - e.ts > WINDOW_MS) {
    hits.set(ip, { count: 1, ts: now });
    return false;
  }
  e.count++;
  return e.count > MAX_HITS;
}

const GENERIC = "No matching record. Check your unit number and PIN.";

export async function lookupBuyer(
  _prev: PortalState,
  formData: FormData,
): Promise<PortalState> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (rateLimited(ip))
    return { ok: false, error: "Too many attempts. Please wait a minute and try again." };

  const unitInput = String(formData.get("unit_number") ?? "").trim();
  const ref_pin = String(formData.get("ref_pin") ?? "").trim();
  if (!unitInput || !ref_pin) return { ok: false, error: "Enter your unit number and PIN." };

  // Strip LIKE wildcards so input can't broaden the match.
  const safeUnit = unitInput.replace(/[%_\\]/g, "");
  const admin = createAdminClient();

  const { data: units } = await admin.from("units").select("id").ilike("unit_number", safeUnit);
  const unitIds = (units ?? []).map((u: { id: string }) => u.id);
  if (unitIds.length === 0) return { ok: false, error: GENERIC };

  const { data: buyer } = await admin
    .from("buyers")
    .select("id, unit_id, contact_label, payment_status, units(unit_number)")
    .in("unit_id", unitIds)
    .eq("ref_pin", ref_pin)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (!buyer) return { ok: false, error: GENERIC };

  const [{ data: soaRow }, { data: pays }, { data: duesRows }] = await Promise.all([
    admin
      .from("buyer_soa")
      .select("computed_json, contract_balance, next_due_date")
      .eq("buyer_id", buyer.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("payments")
      .select("paid_on, doc_type, or_number, amount")
      .eq("buyer_id", buyer.id)
      .order("paid_on", { ascending: false })
      .limit(50),
    // Condo association dues for the owner's unit (reuses rental_dues).
    admin
      .from("rental_dues")
      .select("category, amount, due_date, status")
      .eq("unit_id", buyer.unit_id as string)
      .order("status", { ascending: true })
      .order("due_date", { ascending: true })
      .limit(60),
  ]);

  const soa = soaRow?.computed_json as SOAResult | undefined;
  const condo_dues = (duesRows ?? []).map((d: Record<string, unknown>) => ({
    category: d.category as string,
    amount: Number(d.amount),
    due_date: (d.due_date as string) ?? null,
    status: d.status as string,
  }));
  const condo_dues_total = condo_dues.filter((d) => d.status === "unpaid").reduce((s, d) => s + d.amount, 0);

  return {
    ok: true,
    data: {
      contact_label: buyer.contact_label as string,
      unit_number: (buyer.units as { unit_number?: string } | null)?.unit_number ?? unitInput,
      status: buyer.payment_status as string,
      contract_balance: soaRow?.contract_balance != null ? Number(soaRow.contract_balance) : null,
      amount_due_now: soa?.totals?.amount_due_now ?? null,
      next_due_date: (soaRow?.next_due_date as string) ?? null,
      payments: (pays ?? []).map((p: Record<string, unknown>) => ({
        paid_on: p.paid_on as string,
        doc_type: p.doc_type as string,
        or_number: (p.or_number as string) ?? null,
        amount: Number(p.amount),
      })),
      condo_dues,
      condo_dues_total,
    },
  };
}
