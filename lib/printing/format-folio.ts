"use client";

import { EscPos, COLS } from "./esc-pos";
import { stayTotals, StayCharge } from "@/lib/hotel/rates";

function pP(amount: number): string {
  return "P" + amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function fmtDateCompact(iso: string): string {
  return new Date(iso).toLocaleString("en-PH", {
    month: "numeric", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function hoursUsed(checkIn: string, checkOut?: string | null): string {
  const end = checkOut ? new Date(checkOut) : new Date();
  const mins = Math.max(0, Math.floor((end.getTime() - new Date(checkIn).getTime()) / 60000));
  return `${Math.floor(mins / 60)}h ${(mins % 60).toString().padStart(2, "0")}m`;
}

export interface FolioData {
  brandName: string;
  subtitle?: string;
  roomNumber: string;
  arNo?: string | null;
  guestLabel?: string | null;
  planName?: string | null;
  checkIn: string;
  checkOut?: string | null;
  plannedHours: number;
  extensions?: Array<{ addedHours: number; createdAt: string }>;
  isActive?: boolean;
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

export interface FolioOptions {
  feedLines?: number;  // lines to feed before cut (default 3)
  qrSize?: number;     // QR module size 1–8 (default 6)
}

export interface TestPageOptions {
  paperWidth?: string;  // "58" or "80"
  brandName?: string;
  feedLines?: number;
  qrSize?: number;
}

export function formatTestPage(opts: TestPageOptions = {}): Uint8Array {
  const { brandName = "Sun Miles", feedLines = 1, qrSize = 6 } = opts;
  const e = new EscPos();
  e.init();

  e.align("center")
   .bold(true).doubleHeight(true).text(brandName.slice(0, COLS)).lf()
   .doubleHeight(false).bold(false)
   .text("Printer Test Page").lf()
   .lf(1);

  e.align("left").separator("=");
  e.text("Alignment test:").lf();
  e.row("Left", "Right");
  e.row("Paper width:", `${COLS} cols`);
  e.row("Feed lines:", String(feedLines));
  e.row("QR size:", String(qrSize));
  e.separator("-");

  e.text("Text sizes:").lf();
  e.bold(true).text("Bold text line").lf().bold(false);
  e.doubleHeight(true).text("Dbl height").lf().doubleHeight(false);
  e.text("Normal text line").lf();
  e.separator("-");

  e.text("Number alignment:").lf();
  e.row("Item 1", "P100.00");
  e.row("Item 2", "P1,250.50");
  e.row("Item 3", "P12,000.00");
  e.bold(true).row("TOTAL:", "P13,350.50").bold(false);
  e.separator("=");

  e.align("center")
   .text("QR code test (size " + qrSize + ")").lf();
  e.qr("https://sun-miles-pms.vercel.app", qrSize).lf(1);
  e.text("Printer test successful!").lf();
  e.feedAndCut(feedLines);

  return e.bytes();
}

export function formatFolio(d: FolioData, opts: FolioOptions = {}): Uint8Array {
  const { feedLines = 1, qrSize = 6 } = opts;
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
   .text(d.subtitle ?? "Guest Folio / Receipt").lf()
   .lf(1);

  e.align("left")
   .separator("=");

  // Stay details
  if (d.arNo) e.row("AR No:", d.arNo);
  e.row("Room:", d.roomNumber);
  if (d.guestLabel) e.row("Guest:", d.guestLabel.slice(0, 24));
  if (d.planName) {
    // Plan name can be long — wrap if needed
    const planLabel = "Plan:";
    const maxPlan = COLS - planLabel.length - 1;
    const plan = d.planName.length <= maxPlan
      ? d.planName
      : d.planName.slice(0, maxPlan - 2) + "..";
    e.row(planLabel, plan);
  }
  e.separator();

  // Time section
  e.row("Check-in:", fmtDateCompact(d.checkIn));
  e.row("Base hours:", `${d.stay.base_hours ?? d.plannedHours}h`);
  if (d.extensions && d.extensions.length > 0) {
    for (let i = 0; i < d.extensions.length; i++) {
      e.row(`Ext ${i + 1}:`, `+${d.extensions[i].addedHours}h`);
    }
    e.row("Total planned:", `${d.plannedHours}h`);
  }
  if (d.checkOut) {
    e.row("Check-out:", fmtDateCompact(d.checkOut));
    e.row("Actual used:", hoursUsed(d.checkIn, d.checkOut));
  } else if (d.isActive) {
    e.row("Status:", `Active ${hoursUsed(d.checkIn, null)}`);
  }
  e.separator();

  // Charges
  const rc = t.room_charge;
  e.row("Room charge:", pP(rc));

  if (d.extraPersons && d.extraPersons > 0 && d.extraPersonRate) {
    e.row(`Extra persons (${d.extraPersons}x):`, pP(d.extraPersons * d.extraPersonRate));
  }

  if (t.orders > 0) {
    e.row("Food & beverage:", pP(t.orders));
    for (const o of d.orders) {
      const priceStr = pP(o.qty * o.unit_price);
      const prefix   = `  ${o.qty}x `;
      const maxName  = COLS - prefix.length - priceStr.length - 1;
      const name     = o.name.length <= maxName
        ? o.name
        : o.name.slice(0, maxName - 2) + "..";
      e.row(prefix + name, priceStr);
    }
  }

  e.separator("-");

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

  // Payment rows — format: "  Method OR_NO AR_NO    P350.00"
  if (d.payments.length > 0) {
    for (const p of d.payments) {
      const orPart = p.or_no ? ` ${p.or_no}` : "";
      const arPart = p.ar_no ? ` ${p.ar_no}` : "";
      const fullLabel = `  ${p.method}${orPart}${arPart}`;
      const amtStr = pP(p.amount);
      if (fullLabel.length + 1 + amtStr.length <= COLS) {
        e.row(fullLabel, amtStr);
      } else {
        // Too long — show method+amount, ref on next line
        e.row(`  ${p.method}`.slice(0, COLS - amtStr.length - 1), amtStr);
        const ref = [p.or_no, p.ar_no].filter(Boolean).join(" / ");
        if (ref) e.text(`  ${ref}`).lf();
      }
    }
    e.separator();
  }

  // QR code
  if (d.qrUrl) {
    e.align("center")
     .text("Scan to view your bill, countdown & extend").lf();
    e.qr(d.qrUrl, qrSize).lf(1);
  }

  e.align("center").text("Thank you for staying with us!").lf();
  e.feedAndCut(feedLines);

  return e.bytes();
}
