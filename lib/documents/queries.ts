import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DOC_DONE_STATUSES } from "@/lib/config";
import { computeGates } from "./gates";
import type {
  DocumentType,
  BuyerDocument,
  BuyerFolder,
  FolderRow,
  FolderSummaryItem,
} from "./types";

const DONE = new Set<string>(DOC_DONE_STATUSES);

function mapType(r: Record<string, unknown>): DocumentType {
  return {
    id: r.id as string,
    category: r.category as string,
    name: r.name as string,
    sort_order: r.sort_order as number,
    milestone_gate: (r.milestone_gate as string) ?? null,
    is_sensitive_id: r.is_sensitive_id as boolean,
  };
}
function mapDoc(r: Record<string, unknown>): BuyerDocument {
  return {
    id: r.id as string,
    buyer_id: r.buyer_id as string,
    document_type_id: r.document_type_id as string,
    status: r.status as string,
    file_path: (r.file_path as string) ?? null,
    ref_number: (r.ref_number as string) ?? null,
    doc_date: (r.doc_date as string) ?? null,
    notes: (r.notes as string) ?? null,
  };
}

export async function listDocumentTypes(): Promise<DocumentType[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("document_types")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapType);
}

export async function getBuyerFolder(buyerId: string): Promise<BuyerFolder | null> {
  const supabase = await createClient();
  const { data: buyer, error } = await supabase
    .from("buyers")
    .select("id, contact_label, id_consent_at, units(unit_number)")
    .eq("id", buyerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!buyer) return null;

  const [types, { data: docs }] = await Promise.all([
    listDocumentTypes(),
    supabase.from("buyer_documents").select("*").eq("buyer_id", buyerId),
  ]);
  const byType = new Map<string, BuyerDocument>();
  for (const d of (docs ?? []).map(mapDoc)) byType.set(d.document_type_id, d);

  const rows: FolderRow[] = types.map((t) => ({ type: t, doc: byType.get(t.id) ?? null }));

  return {
    buyer: {
      id: buyer.id as string,
      contact_label: buyer.contact_label as string,
      unit_number: (buyer.units as { unit_number?: string } | null)?.unit_number ?? null,
      id_consent_at: (buyer.id_consent_at as string) ?? null,
    },
    rows,
  };
}

export async function listFolderSummaries(): Promise<FolderSummaryItem[]> {
  const supabase = await createClient();
  const [{ data: buyers }, types, { data: docs }] = await Promise.all([
    supabase
      .from("buyers")
      .select("id, contact_label, units(unit_number)")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    listDocumentTypes(),
    supabase.from("buyer_documents").select("buyer_id, document_type_id, status"),
  ]);

  const statusByBuyer = new Map<string, Map<string, string>>();
  for (const d of (docs ?? []) as { buyer_id: string; document_type_id: string; status: string }[]) {
    let m = statusByBuyer.get(d.buyer_id);
    if (!m) {
      m = new Map();
      statusByBuyer.set(d.buyer_id, m);
    }
    m.set(d.document_type_id, d.status);
  }

  return (buyers ?? []).map((b: Record<string, unknown>) => {
    const sm = statusByBuyer.get(b.id as string) ?? new Map<string, string>();
    const merged = types.map((t) => ({
      milestone_gate: t.milestone_gate,
      status: sm.get(t.id) ?? "pending",
    }));
    const considered = merged.filter((m) => m.status !== "not_required");
    const done = considered.filter((m) => DONE.has(m.status)).length;
    return {
      buyer_id: b.id as string,
      contact_label: b.contact_label as string,
      unit_number: (b.units as { unit_number?: string } | null)?.unit_number ?? null,
      total: considered.length,
      done,
      gates: computeGates(merged),
    };
  });
}
