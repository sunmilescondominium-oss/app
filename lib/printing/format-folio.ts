"use client";

import { EscPos, COLS } from "./esc-pos";
import { stayTotals, StayCharge } from "@/lib/hotel/rates";

// ESC/POS-safe peso amount (no ₱ glyph — use 'P' instead)
function pP(amount: number): string {
  return "P" + amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

export interface FolioData {
  brandName: string;
  roomNumber: string;
  arNo?: string | null;
  guestLabel?: string | null;
  checkIn: string;
  checkOut?: string | null;
  plannedHours: number;
  stay: Parameters<typeof stayTotals>[0];
  paid: number;
  ordersTotal: number;
  discountType?: string | null;
  promoName?: string | null;
  promoDiscountAmount: number;
  extraPersons?: number;
  extraPersonRate?: number;
  taxAmount?: number;
  taxLabel?: string | null;
  payments: Array<{ amount: number; method: string; ar_no?: string | null; or_no?: string | null; created_at: string }>;
  orders: Array<{ name: string; qty: number; unit_price: number }>;
  qrUrl?: string | null;
}

export function formatFolio(d: FolioData): Uint8Array {
  const t: StayCharge = stayTotals(d.stay, d.paid, d.ordersTotal);
  const e = new EscPos();
  e.init();

  // Header
  e.align("center")
   .bold(true)
   .doubleHeight(true)
   .text(d.brandName.slice(0, COLS)).lf()
   .doubleHeight(false)
   .bold(false)
   .text("Hotel Folio / Official Receipt").lf()
   .lf(1);

  e.align("left")
   .separator("=");

  // Stay details
  if (d.arNo) e.row("AR No:", d.arNo);
  e.row("Room:", d.roomNumber);
  if (d.guestLabel) e.row("Guest:", d.guestLabel.slice(0, 28));
  e.row("Check-in:", fmtDate(d.checkIn));
  if (d.checkOut) e.row("Check-out:", fmtDate(d.checkOut));
  e.row("Duration:", `${d.plannedHours}h`);
  e.separator();

  // Charges
  const rc = t.room_charge;
  e.row("Room charge:", pP(rc));

  if (d.extraPersons && d.extraPersons > 0 && d.extraPersonRate) {
    e.row(`Extra persons (${d.extraPersons}x):`, pP(d.extraPersons * d.extraPersonRate));
  }

  if (t.orders > 0) {
    e.row("Food & beverage:", pP(t.orders));
    // Itemize orders
    for (const o of d.orders) {
      const line = `  ${o.qty}x ${o.name.slice(0, 28)}`;
      e.row(line, pP(o.qty * o.unit_price));
    }
  }

  e.separator("-");

  // Discounts
  if (d.promoDiscountAmount > 0 && d.promoName) {
    e.row(`Promo (${d.promoName.slice(0, 20)}):`, "-" + pP(d.promoDiscountAmount));
  }
  const govDisc = t.discount - d.promoDiscountAmount;
  if (govDisc > 0 && d.discountType) {
    const label = d.discountType === "pwd" ? "PWD 20%:" : "Senior Citizen 20%:";
    e.row(label, "-" + pP(govDisc));
  }
  if (d.taxAmount && d.taxAmount > 0) {
    e.row(d.taxLabel ?? "Tax:", pP(d.taxAmount));
  }

  e.separator("=");
  e.bold(true).row("TOTAL:", pP(t.total + (d.taxAmount ?? 0))).bold(false);
  e.row("Paid:", pP(t.paid));
  e.bold(true).row("BALANCE:", pP(t.balance)).bold(false);
  e.separator("=");

  // Payment breakdown
  if (d.payments.length > 0) {
    e.text("Payments:").lf();
    for (const p of d.payments) {
      const label = `  ${fmtDate(p.created_at).slice(0, 22)}`;
      e.row(label, pP(p.amount));
      if (p.ar_no || p.or_no) {
        e.text(`  ${[p.ar_no, p.or_no].filter(Boolean).join(" / ")}`).lf();
      }
    }
    e.separator();
  }

  // QR code
  if (d.qrUrl) {
    e.align("center").text("Scan for online bill:").lf();
    e.qr(d.qrUrl).lf(2);
  }

  e.align("center").text("Thank you for staying with us!").lf().lf(3);
  e.cut();

  return e.bytes();
}
