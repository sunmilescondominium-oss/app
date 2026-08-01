import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SOAResult } from "@/lib/computation/types";
import type {
  Buyer,
  BuyerListItem,
  BuyerDetail,
  Payment,
  ComputationParam,
} from "./types";

function mapBuyer(r: Record<string, unknown>): Buyer {
  const u = r.units as
    | { unit_number: string; tcp?: number | null; properties?: { name?: string } | null }
    | null;
  return {
    id: r.id as string,
    unit_id: (r.unit_id as string) ?? null,
    contact_label: r.contact_label as string,
    ref_pin: r.ref_pin as string,
    payment_scheme: r.payment_scheme as string,
    payment_status: r.payment_status as string,
    tcp: r.tcp != null ? Number(r.tcp) : null,
    downpayment: Number(r.downpayment),
    term_months: r.term_months as number,
    annual_interest_rate: r.annual_interest_rate != null ? Number(r.annual_interest_rate) : null,
    start_date: r.start_date as string,
    is_active: r.is_active as boolean,
    created_at: r.created_at as string,
    unit: u
      ? { unit_number: u.unit_number, property_name: u.properties?.name, tcp: u.tcp != null ? Number(u.tcp) : null }
      : null,
  };
}

export async function listBuyers(): Promise<BuyerListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("buyers")
    .select("*, units(unit_number, tcp, properties(name))")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const buyers = (data ?? []).map(mapBuyer);

  const ids = buyers.map((b) => b.id);
  const latest = new Map<string, { contract_balance: number | null; next_due_date: string | null }>();
  if (ids.length) {
    const { data: soas } = await supabase
      .from("buyer_soa")
      .select("buyer_id, contract_balance, next_due_date, created_at")
      .in("buyer_id", ids)
      .order("created_at", { ascending: false });
    for (const s of (soas ?? []) as Record<string, unknown>[]) {
      const bid = s.buyer_id as string;
      if (!latest.has(bid))
        latest.set(bid, {
          contract_balance: s.contract_balance != null ? Number(s.contract_balance) : null,
          next_due_date: (s.next_due_date as string) ?? null,
        });
    }
  }

  return buyers.map((b) => ({
    ...b,
    contract_balance: latest.get(b.id)?.contract_balance ?? null,
    next_due_date: latest.get(b.id)?.next_due_date ?? null,
  }));
}

export async function getBuyerDetail(id: string): Promise<BuyerDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("buyers")
    .select("*, units(unit_number, tcp, properties(name))")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;

  const buyer = mapBuyer(data);
  const [{ data: pays }, { data: soaRow }] = await Promise.all([
    supabase.from("payments").select("*").eq("buyer_id", id).order("paid_on", { ascending: true }),
    supabase
      .from("buyer_soa")
      .select("*")
      .eq("buyer_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const payments: Payment[] = (pays ?? []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    buyer_id: p.buyer_id as string,
    doc_type: p.doc_type as string,
    or_number: (p.or_number as string) ?? null,
    amount: Number(p.amount),
    paid_on: p.paid_on as string,
    remarks: (p.remarks as string) ?? null,
    created_at: p.created_at as string,
  }));

  const soa = soaRow ? ((soaRow as Record<string, unknown>).computed_json as SOAResult) : null;
  const soaMeta = soaRow
    ? {
        created_at: (soaRow as Record<string, unknown>).created_at as string,
        source: (soaRow as Record<string, unknown>).source as string,
        params_version: ((soaRow as Record<string, unknown>).params_version as number) ?? null,
      }
    : null;

  return { buyer, payments, soa, soaMeta };
}

export async function listComputationParams(): Promise<ComputationParam[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("computation_params")
    .select("*")
    .eq("is_active", true)
    .order("key", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((p: Record<string, unknown>) => ({
    id: p.id as string,
    key: p.key as string,
    value: Number(p.value),
    label: (p.label as string) ?? null,
    params_version: p.params_version as number,
    is_active: p.is_active as boolean,
  }));
}
