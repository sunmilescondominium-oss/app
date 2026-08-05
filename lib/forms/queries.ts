import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { EXTERNAL_ROLE_KEYS } from "@/lib/rbac/modules";
import type { FormType, BusinessEntity, BookletRow, SerialRow, CustodyEntry, SerialStatus } from "@/lib/forms/types";

export type { FormType, BusinessEntity, BookletRow, SerialRow, CustodyEntry, SerialStatus } from "@/lib/forms/types";

export async function listBusinessEntities(): Promise<BusinessEntity[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("business_entities").select("*").eq("is_active", true).order("sort_order").order("name");
  return (data ?? []).map((e) => ({ id: e.id as string, name: e.name as string, tradeName: (e.trade_name as string) ?? null, tin: (e.tin as string) ?? null, rdo: (e.bir_rdo as string) ?? null, address: (e.registered_address as string) ?? null }));
}

/** Roles that may register/close booklets & assign custodians. */
export const FORM_MANAGER_ROLES = ["admin", "managing_officer", "accounting", "hotel_rental_monitoring"];
/** Roles that may mark a serial used/cancelled/spoiled/void (incl. cashiers). */
export const FORM_USER_ROLES = ["admin", "managing_officer", "accounting", "hotel_rental_monitoring", "hotel_cashier"];

async function labels(admin: ReturnType<typeof createAdminClient>): Promise<Map<string, string>> {
  const { data } = await admin.from("profiles").select("id, display_label, full_name");
  return new Map((data ?? []).map((p) => [p.id as string, (p.full_name as string) || (p.display_label as string) || "Staff"]));
}

export async function listFormTypes(): Promise<FormType[]> {
  const admin = createAdminClient();
  const { data } = await admin.from("form_types").select("id, code, name, bir_reportable").eq("is_active", true).order("sort_order");
  return (data ?? []).map((t) => ({ id: t.id as string, code: t.code as string, name: t.name as string, birReportable: (t.bir_reportable as boolean) ?? true }));
}

export async function listBooklets(): Promise<BookletRow[]> {
  const admin = createAdminClient();
  const [{ data: booklets }, { data: types }, { data: serials }, { data: entities }, lbl] = await Promise.all([
    admin.from("form_booklets").select("*").order("created_at", { ascending: false }),
    admin.from("form_types").select("id, code, name"),
    admin.from("form_serials").select("booklet_id, status"),
    admin.from("business_entities").select("id, name, tin"),
    labels(createAdminClient()),
  ]);
  const typeById = new Map((types ?? []).map((t) => [t.id as string, t]));
  const entityById = new Map((entities ?? []).map((e) => [e.id as string, e]));
  const countsBy = new Map<string, Record<SerialStatus, number>>();
  for (const s of serials ?? []) {
    const c = countsBy.get(s.booklet_id as string) ?? { unused: 0, used: 0, cancelled: 0, spoiled: 0, void: 0 };
    c[s.status as SerialStatus] += 1;
    countsBy.set(s.booklet_id as string, c);
  }
  return (booklets ?? []).map((b) => {
    const t = typeById.get(b.form_type_id as string);
    const e = b.business_entity_id ? entityById.get(b.business_entity_id as string) : null;
    const counts = countsBy.get(b.id as string) ?? { unused: 0, used: 0, cancelled: 0, spoiled: 0, void: 0 };
    const total = Number(b.serial_to) - Number(b.serial_from) + 1;
    return {
      id: b.id as string, bookletNo: b.booklet_no as string,
      typeCode: (t?.code as string) ?? "—", typeName: (t?.name as string) ?? "—",
      prefix: (b.prefix as string) ?? "", from: Number(b.serial_from), to: Number(b.serial_to), total,
      custodianLabel: b.custodian_user_id ? lbl.get(b.custodian_user_id as string) ?? null : null,
      custodianRole: (b.custodian_role as string) ?? null,
      status: b.status as string, counts,
      accounted: counts.used + counts.cancelled + counts.spoiled + counts.void,
      entityId: (b.business_entity_id as string) ?? null, entityName: (e?.name as string) ?? null, entityTin: (e?.tin as string) ?? null,
      birAtpNo: (b.bir_atp_no as string) ?? null, birAtpDate: (b.bir_atp_date as string) ?? null, printerName: (b.printer_name as string) ?? null,
    };
  });
}

export async function bookletDetail(id: string): Promise<{ booklet: BookletRow; serials: SerialRow[]; custody: CustodyEntry[] } | null> {
  const admin = createAdminClient();
  const { data: b } = await admin.from("form_booklets").select("*").eq("id", id).maybeSingle();
  if (!b) return null;
  const [{ data: type }, { data: serials }, { data: custody }, { data: entity }, lbl] = await Promise.all([
    admin.from("form_types").select("code, name").eq("id", b.form_type_id).maybeSingle(),
    admin.from("form_serials").select("*").eq("booklet_id", id).order("serial_no"),
    admin.from("form_custody").select("*").eq("booklet_id", id).order("changed_at", { ascending: false }),
    b.business_entity_id ? admin.from("business_entities").select("name, tin").eq("id", b.business_entity_id).maybeSingle() : Promise.resolve({ data: null }),
    labels(createAdminClient()),
  ]);
  const counts: Record<SerialStatus, number> = { unused: 0, used: 0, cancelled: 0, spoiled: 0, void: 0 };
  for (const s of serials ?? []) counts[s.status as SerialStatus] += 1;
  const total = Number(b.serial_to) - Number(b.serial_from) + 1;
  return {
    booklet: {
      id: b.id as string, bookletNo: b.booklet_no as string,
      typeCode: (type?.code as string) ?? "—", typeName: (type?.name as string) ?? "—",
      prefix: (b.prefix as string) ?? "", from: Number(b.serial_from), to: Number(b.serial_to), total,
      custodianLabel: b.custodian_user_id ? lbl.get(b.custodian_user_id as string) ?? null : null,
      custodianRole: (b.custodian_role as string) ?? null, status: b.status as string, counts,
      accounted: counts.used + counts.cancelled + counts.spoiled + counts.void,
      entityId: (b.business_entity_id as string) ?? null, entityName: (entity?.name as string) ?? null, entityTin: (entity?.tin as string) ?? null,
      birAtpNo: (b.bir_atp_no as string) ?? null, birAtpDate: (b.bir_atp_date as string) ?? null, printerName: (b.printer_name as string) ?? null,
    },
    serials: (serials ?? []).map((s) => ({
      id: s.id as string, serialNo: Number(s.serial_no), label: s.serial_label as string, status: s.status as SerialStatus,
      issuedTo: (s.issued_to as string) ?? null, reference: (s.reference as string) ?? null, amount: s.amount == null ? null : Number(s.amount),
      usedByRole: (s.used_by_role as string) ?? null, usedAt: (s.used_at as string) ?? null, remarks: (s.remarks as string) ?? null,
    })),
    custody: (custody ?? []).map((c) => ({
      fromLabel: c.from_user_id ? lbl.get(c.from_user_id as string) ?? null : null,
      toLabel: c.to_user_id ? lbl.get(c.to_user_id as string) ?? null : null,
      byLabel: c.changed_by ? lbl.get(c.changed_by as string) ?? null : null,
      at: c.changed_at as string, note: (c.note as string) ?? null,
    })),
  };
}

/** Active staff who can be named custodians (id, label, first staff role). */
export async function custodianOptions(): Promise<{ userId: string; label: string; role: string | null }[]> {
  const admin = createAdminClient();
  const [{ data: profiles }, { data: roles }] = await Promise.all([
    admin.from("profiles").select("id, display_label, full_name, is_active"),
    admin.from("user_roles").select("user_id, role_key"),
  ]);
  const roleByUser = new Map<string, string>();
  for (const r of roles ?? []) {
    const key = r.role_key as string;
    if ((EXTERNAL_ROLE_KEYS as readonly string[]).includes(key)) continue;
    if (!roleByUser.has(r.user_id as string)) roleByUser.set(r.user_id as string, key);
  }
  return (profiles ?? [])
    .filter((p) => p.is_active && roleByUser.has(p.id as string))
    .map((p) => ({ userId: p.id as string, label: (p.full_name as string) || (p.display_label as string) || "Staff", role: roleByUser.get(p.id as string) ?? null }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
