"use server";

import { revalidatePath } from "next/cache";
import { requireModuleWrite, requireAuth, userHasAnyRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { BUSINESS_LINES, UNIT_STATUSES, type UnitStatus } from "@/lib/config";
import type { FieldDefinition, UnitImportRow } from "@/lib/inventory/types";

export type ActionResult = { ok: true } | { ok: false; error: string };
export type ImportResult =
  | { ok: true; inserted: number; errors: { row: number; error: string }[] }
  | { ok: false; error: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;

const BL_KEYS: readonly string[] = BUSINESS_LINES.map((b) => b.key);
const STATUS_KEYS: readonly string[] = UNIT_STATUSES;
const FIELD_MANAGER_ROLES = ["admin", "managing_officer"];

// ---- small parse helpers -------------------------------------------------
function str(v: FormDataEntryValue | null): string {
  return String(v ?? "").trim();
}
function orNull(v: unknown): string | null {
  const s = String(v ?? "").trim();
  return s ? s : null;
}
function numOrNull(v: unknown): number | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function normStatus(v: string): UnitStatus | null {
  const s = v.trim().toLowerCase();
  return STATUS_KEYS.includes(s) ? (s as UnitStatus) : null;
}
function friendly(msg: string): string {
  if (/duplicate key|unique/i.test(msg))
    return "That unit / room number already exists for this property.";
  return msg;
}

// ---- custom fields -------------------------------------------------------
async function loadFieldDefs(
  supabase: Supabase,
  businessLine: string,
): Promise<FieldDefinition[]> {
  const { data } = await supabase
    .from("unit_field_definitions")
    .select("*")
    .eq("is_active", true)
    .or(`business_line.eq.${businessLine},business_line.is.null`)
    .order("sort_order", { ascending: true });
  return (data ?? []).map((d: Record<string, unknown>) => ({
    ...(d as unknown as FieldDefinition),
    options: Array.isArray(d.options) ? (d.options as string[]) : [],
  }));
}

function coerceValue(
  def: FieldDefinition,
  raw: string,
): { ok: true; value: unknown } | { ok: false; error: string } {
  const s = raw.trim();
  switch (def.data_type) {
    case "number": {
      const n = Number(s);
      if (!Number.isFinite(n)) return { ok: false, error: `${def.label} must be a number.` };
      return { ok: true, value: n };
    }
    case "boolean":
      return { ok: true, value: s === "true" || s === "on" || s === "1" || s === "yes" };
    case "select":
      if (def.options.length && !def.options.includes(s))
        return { ok: false, error: `${def.label}: "${s}" is not a valid option.` };
      return { ok: true, value: s };
    default:
      return { ok: true, value: s }; // text, date (stored as string)
  }
}

/** Build custom_fields from a FormData (inputs named cf__<key>). */
function customFieldsFromForm(
  formData: FormData,
  defs: FieldDefinition[],
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  const out: Record<string, unknown> = {};
  for (const d of defs) {
    const raw = str(formData.get(`cf__${d.key}`));
    if (!raw) {
      if (d.is_required) return { ok: false, error: `${d.label} is required.` };
      continue;
    }
    const c = coerceValue(d, raw);
    if (!c.ok) return c;
    out[d.key] = c.value;
  }
  return { ok: true, value: out };
}

// ---- create --------------------------------------------------------------
export async function createUnit(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireModuleWrite("inventory");
  const supabase = createAdminClient();

  const unit_number = str(formData.get("unit_number"));
  const business_line = str(formData.get("business_line")).toLowerCase();
  const status = normStatus(str(formData.get("status")) || "available");
  const property_id_in = str(formData.get("property_id"));
  const new_property = str(formData.get("new_property_name"));

  if (!unit_number) return { ok: false, error: "Unit / room number is required." };
  if (!BL_KEYS.includes(business_line))
    return { ok: false, error: "Choose a business line." };
  if (!status) return { ok: false, error: "Invalid status." };
  if (!property_id_in && !new_property)
    return { ok: false, error: "Choose a property or add a new one." };

  const defs = await loadFieldDefs(supabase, business_line);
  const cf = customFieldsFromForm(formData, defs);
  if (!cf.ok) return cf;

  let property_id = property_id_in;
  if (!property_id) {
    const r = await resolvePropertyId(supabase, new_property);
    if (!r.ok) return r;
    property_id = r.id;
  }

  const { data, error } = await supabase
    .from("units")
    .insert({
      property_id,
      unit_number,
      unit_type: orNull(formData.get("unit_type")),
      floor: orNull(formData.get("floor")),
      area_sqm: numOrNull(formData.get("area_sqm")),
      tcp: numOrNull(formData.get("tcp")),
      status,
      business_line,
      custom_fields: cf.value,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: friendly(error.message) };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "units",
    entityId: data.id as string,
    diff: { unit_number, business_line, status },
  });
  revalidatePath("/inventory");
  return { ok: true };
}

// ---- update (also handles recategorize via business_line) ----------------
export async function updateUnit(
  id: string,
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireModuleWrite("inventory");
  const supabase = createAdminClient();

  const unit_number = str(formData.get("unit_number"));
  const business_line = str(formData.get("business_line")).toLowerCase();
  const status = normStatus(str(formData.get("status")) || "available");

  if (!unit_number) return { ok: false, error: "Unit / room number is required." };
  if (!BL_KEYS.includes(business_line))
    return { ok: false, error: "Choose a business line." };
  if (!status) return { ok: false, error: "Invalid status." };

  const defs = await loadFieldDefs(supabase, business_line);
  const cf = customFieldsFromForm(formData, defs);
  if (!cf.ok) return cf;

  const patch = {
    unit_number,
    unit_type: orNull(formData.get("unit_type")),
    floor: orNull(formData.get("floor")),
    area_sqm: numOrNull(formData.get("area_sqm")),
    tcp: numOrNull(formData.get("tcp")),
    status,
    business_line,
    custom_fields: cf.value,
  };

  const { error } = await supabase.from("units").update(patch).eq("id", id);
  if (error) return { ok: false, error: friendly(error.message) };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "update",
    entity: "units",
    entityId: id,
    diff: patch,
  });
  revalidatePath("/inventory");
  return { ok: true };
}

// ---- deactivate / reactivate (soft delete) -------------------------------
export async function setUnitActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const user = await requireModuleWrite("inventory");
  const supabase = createAdminClient();

  const { error } = await supabase.from("units").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: active ? "update" : "delete",
    entity: "units",
    entityId: id,
    diff: { is_active: active },
  });
  revalidatePath("/inventory");
  return { ok: true };
}

// ---- bulk operations -----------------------------------------------------
export type BulkResult =
  | { ok: true; affected: number; skipped: { id: string; reason: string }[] }
  | { ok: false; error: string };

const HARD_DELETE_ROLES = ["admin", "managing_officer", "consultant"];

/** Bulk deactivate/reactivate units (soft — keeps history & links). */
export async function bulkSetUnitsActive(ids: string[], active: boolean): Promise<BulkResult> {
  const user = await requireModuleWrite("inventory");
  const list = Array.from(new Set(ids.filter(Boolean)));
  if (list.length === 0) return { ok: false, error: "No rows selected." };
  const admin = createAdminClient();
  const { error } = await admin.from("units").update({ is_active: active }).in("id", list);
  if (error) return { ok: false, error: error.message };
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: active ? "update" : "delete", entity: "units", entityId: null, diff: { bulk_active: active, count: list.length } });
  revalidatePath("/inventory");
  return { ok: true, affected: list.length, skipped: [] };
}

/** Bulk PERMANENT delete. Rows referenced by other records are skipped with a
 *  reason (FK-safe) so demo/erroneous entries can be removed without breaking
 *  history. Admin / managing officer / consultant only. */
export async function bulkDeleteUnits(ids: string[]): Promise<BulkResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, HARD_DELETE_ROLES)) return { ok: false, error: "Only an admin or managing officer can permanently delete." };
  const list = Array.from(new Set(ids.filter(Boolean)));
  if (list.length === 0) return { ok: false, error: "No rows selected." };
  if (list.length > 500) return { ok: false, error: "Select 500 or fewer rows per delete." };

  const admin = createAdminClient();
  let affected = 0;
  const skipped: { id: string; reason: string }[] = [];
  for (const id of list) {
    const { error } = await admin.from("units").delete().eq("id", id);
    if (error) {
      // FK violation → the unit is referenced elsewhere (buyer, lease, collection…).
      skipped.push({ id, reason: /foreign key|violates/i.test(error.message) ? "referenced by other records (deactivate instead)" : error.message });
    } else {
      affected += 1;
    }
  }
  await logAudit({ actorUserId: user.userId, actorRoles: user.roleKeys, action: "delete", entity: "units", entityId: null, diff: { hard_delete: true, deleted: affected, skipped: skipped.length } });
  revalidatePath("/inventory");
  return { ok: true, affected, skipped };
}

// ---- custom-field DEFINITIONS (admin / managing_officer) -----------------
function slugify(v: string): string {
  return v
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export async function createFieldDefinition(
  _prev: ActionResult | undefined,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, FIELD_MANAGER_ROLES))
    return { ok: false, error: "Only an admin or managing officer can manage fields." };

  const supabase = await createClient();
  const label = str(formData.get("label"));
  const key = slugify(str(formData.get("key")) || label);
  const business_line_in = str(formData.get("business_line"));
  const data_type = str(formData.get("data_type")) || "text";
  const optionsRaw = str(formData.get("options"));
  const is_required = str(formData.get("is_required")) === "on";
  const sort_order = numOrNull(formData.get("sort_order")) ?? 100;

  if (!label) return { ok: false, error: "Label is required." };
  if (!key) return { ok: false, error: "Could not derive a field key from the label." };
  if (!["text", "number", "date", "select", "boolean"].includes(data_type))
    return { ok: false, error: "Invalid field type." };
  const business_line =
    business_line_in && BL_KEYS.includes(business_line_in) ? business_line_in : null;
  const options =
    data_type === "select"
      ? optionsRaw.split(",").map((o) => o.trim()).filter(Boolean)
      : [];

  const { error } = await supabase.from("unit_field_definitions").insert({
    business_line,
    key,
    label,
    data_type,
    options,
    is_required,
    sort_order,
  });
  if (error) {
    if (/duplicate key|unique/i.test(error.message))
      return { ok: false, error: `A field "${key}" already exists for that scope.` };
    return { ok: false, error: error.message };
  }

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "unit_field_definitions",
    entityId: key,
    diff: { business_line, key, data_type },
  });
  revalidatePath("/inventory");
  return { ok: true };
}

export async function setFieldDefinitionActive(
  id: string,
  active: boolean,
): Promise<ActionResult> {
  const user = await requireAuth();
  if (!userHasAnyRole(user, FIELD_MANAGER_ROLES))
    return { ok: false, error: "Not allowed." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("unit_field_definitions")
    .update({ is_active: active })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/inventory");
  return { ok: true };
}

// ---- property resolution -------------------------------------------------
async function resolvePropertyId(
  supabase: Supabase,
  name: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const clean = name.trim();
  if (!clean) return { ok: false, error: "Property name is empty." };

  const { data: found } = await supabase
    .from("properties")
    .select("id")
    .ilike("name", clean)
    .limit(1)
    .maybeSingle();
  if (found?.id) return { ok: true, id: found.id as string };

  const { data: created, error } = await supabase
    .from("properties")
    .insert({ name: clean })
    .select("id")
    .single();
  if (error) {
    const { data: retry } = await supabase
      .from("properties")
      .select("id")
      .ilike("name", clean)
      .limit(1)
      .maybeSingle();
    if (retry?.id) return { ok: true, id: retry.id as string };
    return { ok: false, error: `Could not resolve property "${clean}": ${error.message}` };
  }
  return { ok: true, id: created.id as string };
}

// ---- CSV bulk import -----------------------------------------------------
function validateImportRow(
  row: UnitImportRow,
  defsByLine: Map<string, FieldDefinition[]>,
):
  | { ok: true; value: Record<string, unknown> & { _property: string } }
  | { ok: false; error: string } {
  const property = (row.property ?? "").trim();
  const unit_number = (row.unit_number ?? "").trim();
  if (!property) return { ok: false, error: "missing property" };
  if (!unit_number) return { ok: false, error: "missing unit_number" };

  const business_line = (row.business_line ?? "").trim().toLowerCase();
  if (!BL_KEYS.includes(business_line))
    return { ok: false, error: `invalid business_line "${row.business_line ?? ""}"` };

  const status = normStatus((row.status ?? "").trim() || "available");
  if (!status) return { ok: false, error: `invalid status "${row.status ?? ""}"` };

  // Map any extra columns matching a custom-field key into custom_fields.
  const custom_fields: Record<string, unknown> = {};
  const defs = [
    ...(defsByLine.get(business_line) ?? []),
    ...(defsByLine.get("*") ?? []),
  ];
  for (const d of defs) {
    const raw = (row[d.key] ?? "").trim();
    if (!raw) continue;
    const c = coerceValue(d, raw);
    if (!c.ok) return { ok: false, error: c.error };
    custom_fields[d.key] = c.value;
  }

  return {
    ok: true,
    value: {
      _property: property,
      unit_number,
      unit_type: orNull(row.unit_type),
      floor: orNull(row.floor),
      area_sqm: numOrNull(row.area_sqm),
      tcp: numOrNull(row.tcp),
      status,
      business_line,
      custom_fields,
    },
  };
}

export async function bulkImportUnits(rows: UnitImportRow[]): Promise<ImportResult> {
  const user = await requireModuleWrite("inventory");
  const supabase = await createClient();

  if (!Array.isArray(rows) || rows.length === 0)
    return { ok: false, error: "No rows to import." };
  if (rows.length > 5000)
    return { ok: false, error: "Too many rows in one import (max 5000)." };

  // Group active field defs by business line ('*' = applies to all).
  const { data: defRows } = await supabase
    .from("unit_field_definitions")
    .select("*")
    .eq("is_active", true);
  const defsByLine = new Map<string, FieldDefinition[]>();
  for (const d of (defRows ?? []) as FieldDefinition[]) {
    const k = d.business_line ?? "*";
    const arr = defsByLine.get(k) ?? [];
    arr.push({ ...d, options: Array.isArray(d.options) ? d.options : [] });
    defsByLine.set(k, arr);
  }

  const errors: { row: number; error: string }[] = [];
  const propCache = new Map<string, string>();
  const toUpsert: Record<string, unknown>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const v = validateImportRow(rows[i], defsByLine);
    if (!v.ok) {
      errors.push({ row: i + 2, error: v.error }); // +2: header + 1-index
      continue;
    }
    const { _property, ...unit } = v.value;
    const key = _property.toLowerCase();
    let pid = propCache.get(key);
    if (!pid) {
      const r = await resolvePropertyId(supabase, _property);
      if (!r.ok) {
        errors.push({ row: i + 2, error: r.error });
        continue;
      }
      pid = r.id;
      propCache.set(key, pid);
    }
    toUpsert.push({ ...unit, property_id: pid });
  }

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from("units")
      .upsert(toUpsert, { onConflict: "property_id,unit_number" });
    if (error) return { ok: false, error: friendly(error.message) };
  }

  await logAudit({
    actorUserId: user.userId,
    actorRoles: user.roleKeys,
    action: "create",
    entity: "units",
    entityId: null,
    diff: { imported: toUpsert.length, skipped: errors.length },
  });
  revalidatePath("/inventory");
  return { ok: true, inserted: toUpsert.length, errors };
}
