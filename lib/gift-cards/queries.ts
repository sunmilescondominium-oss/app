import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  GiftCard,
  GiftCardDetail,
  GiftCardReservation,
  GiftCardTransaction,
  GiftCardLoadRequest,
} from "./types";

function mapCard(r: Record<string, unknown>): GiftCard {
  return {
    id: r.id as string,
    card_code: r.card_code as string,
    portal_token: r.portal_token as string,
    owner_label: r.owner_label as string,
    owner_contact: (r.owner_contact as string) ?? null,
    purchase_price: Number(r.purchase_price),
    total_hours: Number(r.total_hours),
    balance_hours: Number(r.balance_hours),
    max_hours_per_stay: r.max_hours_per_stay as number,
    max_extension_hours: r.max_extension_hours as number,
    buffer_minutes: r.buffer_minutes as number,
    is_active: r.is_active as boolean,
    is_loadable: r.is_loadable as boolean,
    expires_at: (r.expires_at as string) ?? null,
    sold_by_role: (r.sold_by_role as string) ?? null,
    notes: (r.notes as string) ?? null,
    created_at: r.created_at as string,
  };
}

function mapTx(r: Record<string, unknown>): GiftCardTransaction {
  return {
    id: r.id as string,
    gift_card_id: r.gift_card_id as string,
    stay_id: (r.stay_id as string) ?? null,
    reservation_id: (r.reservation_id as string) ?? null,
    load_request_id: (r.load_request_id as string) ?? null,
    type: r.type as GiftCardTransaction["type"],
    hours: Number(r.hours),
    balance_after: Number(r.balance_after),
    amount_paid: r.amount_paid != null ? Number(r.amount_paid) : null,
    payment_method: (r.payment_method as string) ?? null,
    notes: (r.notes as string) ?? null,
    created_at: r.created_at as string,
  };
}

function mapReservation(r: Record<string, unknown>): GiftCardReservation {
  const u = r.units as { unit_number?: string } | null;
  const gc = r.gift_cards as { card_code?: string; owner_label?: string } | null;
  return {
    id: r.id as string,
    gift_card_id: r.gift_card_id as string,
    unit_id: (r.unit_id as string) ?? null,
    planned_hours: r.planned_hours as number,
    scheduled_at: r.scheduled_at as string,
    buffer_minutes: r.buffer_minutes as number,
    status: r.status as GiftCardReservation["status"],
    notes: (r.notes as string) ?? null,
    stay_id: (r.stay_id as string) ?? null,
    no_show_at: (r.no_show_at as string) ?? null,
    checked_in_at: (r.checked_in_at as string) ?? null,
    cancelled_at: (r.cancelled_at as string) ?? null,
    created_at: r.created_at as string,
    unit_number: u?.unit_number ?? null,
    card_code: gc?.card_code,
    owner_label: gc?.owner_label,
  };
}

function mapLoadRequest(r: Record<string, unknown>): GiftCardLoadRequest {
  return {
    id: r.id as string,
    gift_card_id: r.gift_card_id as string,
    amount_paid: Number(r.amount_paid),
    payment_method: r.payment_method as string,
    reference_no: (r.reference_no as string) ?? null,
    hours_requested: Number(r.hours_requested),
    status: r.status as GiftCardLoadRequest["status"],
    notes: (r.notes as string) ?? null,
    review_note: (r.review_note as string) ?? null,
    reviewed_at: (r.reviewed_at as string) ?? null,
    created_at: r.created_at as string,
  };
}

export async function listGiftCards(): Promise<GiftCard[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("gift_cards")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => mapCard(r as Record<string, unknown>));
}

export async function getGiftCard(id: string): Promise<GiftCardDetail | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("gift_cards").select("*").eq("id", id).maybeSingle();
  if (!data) return null;

  const [{ data: txs }, { data: resvs }, { data: loads }] = await Promise.all([
    admin.from("gift_card_transactions").select("*").eq("gift_card_id", id).order("created_at", { ascending: false }),
    admin.from("gift_card_reservations").select("*, units(unit_number)").eq("gift_card_id", id).order("scheduled_at", { ascending: false }),
    admin.from("gift_card_load_requests").select("*").eq("gift_card_id", id).order("created_at", { ascending: false }),
  ]);

  return {
    ...mapCard(data as Record<string, unknown>),
    transactions: (txs ?? []).map((r) => mapTx(r as Record<string, unknown>)),
    reservations: (resvs ?? []).map((r) => mapReservation(r as Record<string, unknown>)),
    load_requests: (loads ?? []).map((r) => mapLoadRequest(r as Record<string, unknown>)),
  };
}

export async function getGiftCardByToken(token: string): Promise<GiftCardDetail | null> {
  const admin = createAdminClient();
  const { data } = await admin.from("gift_cards").select("*").eq("portal_token", token).maybeSingle();
  if (!data) return null;
  return getGiftCard((data as Record<string, unknown>).id as string);
}

/** Public login: returns the portal_token on success, null on bad credentials. */
export async function lookupGiftCardToken(cardCode: string, pinHash: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("gift_cards")
    .select("portal_token, pin_hash, is_active")
    .eq("card_code", cardCode.trim().toUpperCase())
    .maybeSingle();
  if (!data) return null;
  const r = data as Record<string, unknown>;
  if (!r.is_active) return null;
  if (r.pin_hash !== pinHash) return null;
  return r.portal_token as string;
}

/** Pending reservations for a given date (Manila timezone), used on hotel board. */
export async function listPendingReservationsForDate(date: string): Promise<GiftCardReservation[]> {
  const admin = createAdminClient();
  // Fetch reservations whose scheduled_at falls on the given Manila date
  const from = `${date}T00:00:00+08:00`;
  const to = `${date}T23:59:59+08:00`;
  const { data } = await admin
    .from("gift_card_reservations")
    .select("*, units(unit_number), gift_cards(card_code, owner_label)")
    .in("status", ["pending", "checked_in"])
    .gte("scheduled_at", from)
    .lte("scheduled_at", to)
    .order("scheduled_at", { ascending: true });
  return (data ?? []).map((r) => mapReservation(r as Record<string, unknown>));
}

/** All pending load requests (for admin dashboard widget). */
export async function listPendingLoadRequests(): Promise<(GiftCardLoadRequest & { card_code: string; owner_label: string })[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("gift_card_load_requests")
    .select("*, gift_cards(card_code, owner_label)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  return (data ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const gc = row.gift_cards as { card_code?: string; owner_label?: string } | null;
    return {
      ...mapLoadRequest(row),
      card_code: gc?.card_code ?? "—",
      owner_label: gc?.owner_label ?? "—",
    };
  });
}

/** Pending reservations past their no-show deadline (for cron). */
export async function listOverdueReservations(): Promise<{ id: string; gift_card_id: string; planned_hours: number; buffer_minutes: number; scheduled_at: string }[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("gift_card_reservations")
    .select("id, gift_card_id, planned_hours, buffer_minutes, scheduled_at")
    .eq("status", "pending");
  const now = Date.now();
  return (data ?? []).filter((r) => {
    const row = r as Record<string, unknown>;
    const deadline = new Date(row.scheduled_at as string).getTime() + Number(row.buffer_minutes) * 60_000;
    return deadline < now;
  }) as { id: string; gift_card_id: string; planned_hours: number; buffer_minutes: number; scheduled_at: string }[];
}
