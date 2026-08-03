"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { RENTAL_DUE_CATEGORIES } from "@/lib/config";

export interface RenterResult {
  tenant: string;
  unit_number: string;
  business_line: string;
  rent: number;
  billing_cycle: string;
  end_at: string | null;
  dues: { category: string; amount: number; due_date: string; status: string; ar_no: string | null; remarks: string | null }[];
  totalDue: number;
}

export type RenterState = { ok: true; data: RenterResult } | { ok: false; error: string } | undefined;

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

const LABEL = Object.fromEntries(RENTAL_DUE_CATEGORIES.map((c) => [c.key, c.label]));
const GENERIC = "No matching record. Check your unit number and PIN.";

export async function lookupRenter(_prev: RenterState, formData: FormData): Promise<RenterState> {
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (rateLimited(ip)) return { ok: false, error: "Too many attempts. Please wait a minute." };

  const unitInput = String(formData.get("unit_number") ?? "").trim();
  const pin = String(formData.get("pin") ?? "").trim();
  if (!unitInput || !pin) return { ok: false, error: "Enter your unit number and PIN." };

  const admin = createAdminClient();
  const safe = unitInput.replace(/[%_\\]/g, "");
  const { data: units } = await admin.from("units").select("id, unit_number, business_line").ilike("unit_number", safe).in("business_line", ["rental", "airbnb"]);
  const unit = (units ?? [])[0];
  if (!unit) return { ok: false, error: GENERIC };

  const { data: lease } = await admin
    .from("leases")
    .select("id, tenant_label, rent_amount, billing_cycle, end_at")
    .eq("unit_id", unit.id)
    .eq("status", "active")
    .eq("portal_pin", pin)
    .maybeSingle();
  if (!lease) return { ok: false, error: GENERIC };

  const { data: dues } = await admin
    .from("rental_dues")
    .select("category, amount, due_date, status, ar_no, remarks")
    .eq("unit_id", unit.id)
    .order("due_date", { ascending: false })
    .limit(50);

  const rows = (dues ?? []).map((d) => ({
    category: (LABEL[d.category as string] as string) ?? (d.category as string),
    amount: Number(d.amount),
    due_date: d.due_date as string,
    status: d.status as string,
    ar_no: (d.ar_no as string | null) ?? null,
    remarks: (d.remarks as string | null) ?? null,
  }));
  const totalDue = Math.round(rows.filter((r) => r.status === "unpaid").reduce((s, r) => s + r.amount, 0) * 100) / 100;

  return {
    ok: true,
    data: {
      tenant: lease.tenant_label as string,
      unit_number: unit.unit_number as string,
      business_line: unit.business_line as string,
      rent: Number(lease.rent_amount),
      billing_cycle: lease.billing_cycle as string,
      end_at: (lease.end_at as string | null) ?? null,
      dues: rows,
      totalDue,
    },
  };
}
