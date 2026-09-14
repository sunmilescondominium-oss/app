/**
 * Pre-built print templates for common label/receipt types.
 * Imports from esc-pos.ts only — no BLE, no UI, no app-specific logic.
 * All functions return a ready-to-send Uint8Array (or Promise<Uint8Array>
 * for templates that may include images).
 */

import {
  COMMANDS,
  buildText,
  buildDivider,
  buildQRCode,
  buildBarcode,
  buildImage,
  mergeCommands,
} from "./esc-pos";

/** Column width for label/receipt templates (58mm @ 203dpi ≈ 32 normal chars). */
const COLS = 32;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function seq(...parts: (Uint8Array | readonly number[] | number[])[]): Uint8Array {
  return mergeCommands(...parts);
}

/** Left label + right-aligned value on one COLS-wide line. */
function padRow(label: string, value: string, width = COLS): Uint8Array {
  const gap = width - label.length - value.length;
  const line = gap > 0
    ? label + " ".repeat(gap) + value
    : label.slice(0, width - value.length - 1) + " " + value;
  return buildText(line);
}

function fmt2(n: number): string {
  return n.toFixed(2);
}

// ─── Type definitions ─────────────────────────────────────────────────────────

export interface ReceiptData {
  businessName: string;
  address?: string;
  receiptNo: string;
  date: string;
  cashier?: string;
  items: { name: string; qty: number; price: number }[];
  subtotal: number;
  discount?: number;
  total: number;
  paymentMethod: string;
  amountPaid?: number;
  change?: number;
  footer?: string;
}

export interface StickerLabelData {
  title: string;
  qrData: string;
  qrSize?: number;
  line1?: string;
  line2?: string;
  line3?: string;
  barcode?: string;
  barcodeType?: string;
  footer?: string;
}

export interface IdBadgeData {
  orgName: string;
  eventName: string;
  holderName: string;
  role: string;
  idNumber: string;
  qrData: string;
  validUntil?: string;
}

export interface PaymentConfirmationData {
  orgName: string;
  paymentFor: string;
  payerName: string;
  referenceNo: string;
  amount: number;
  paymentMethod: string;
  date: string;
  receivedBy?: string;
  notes?: string;
}

export interface InventoryLabelData {
  itemName: string;
  itemCode: string;
  category?: string;
  quantity: string;
  location: string;
  barcode: string;
  barcodeType?: string;
  dateTagged: string;
}

export type CustomLine =
  | { type: "text";    content: string; align?: "left" | "center" | "right"; bold?: boolean; size?: "normal" | "double" | "large" }
  | { type: "qr";      data: string; size?: number }
  | { type: "barcode"; data: string; barcodeType?: string }
  | { type: "divider"; char?: string; width?: number }
  | { type: "feed";    lines: number }
  | { type: "image";   dataUrl: string }
  | { type: "cut" };

// ─── Template 1: Receipt ──────────────────────────────────────────────────────

export function receipt(d: ReceiptData): Uint8Array {
  const parts: (Uint8Array | readonly number[] | number[])[] = [
    COMMANDS.init,

    // Header
    COMMANDS.align.center,
    COMMANDS.bold.on,
    COMMANDS.textSize.doubleAll,
    buildText(d.businessName.slice(0, 16)),
    COMMANDS.textSize.normal,
    COMMANDS.bold.off,
  ];

  if (d.address) parts.push(buildText(d.address));

  parts.push(
    COMMANDS.align.left,
    buildDivider("-", COLS),
    padRow("Receipt No:", d.receiptNo),
    padRow("Date:", d.date),
  );
  if (d.cashier) parts.push(padRow("Cashier:", d.cashier));

  parts.push(buildDivider("-", COLS));

  // Items
  for (const item of d.items) {
    const right = `${item.qty} x ${fmt2(item.price)}`;
    const left = item.name.slice(0, COLS - right.length - 1);
    parts.push(buildText(left.padEnd(COLS - right.length) + right));
  }

  parts.push(buildDivider("-", COLS));

  parts.push(padRow("Subtotal:", fmt2(d.subtotal)));
  if (d.discount && d.discount > 0) parts.push(padRow("Discount:", `-${fmt2(d.discount)}`));

  parts.push(
    COMMANDS.bold.on,
    padRow("TOTAL:", fmt2(d.total)),
    COMMANDS.bold.off,
    padRow("Payment:", d.paymentMethod),
  );
  if (d.amountPaid != null) parts.push(padRow("Paid:", fmt2(d.amountPaid)));
  if (d.change      != null) parts.push(padRow("Change:", fmt2(d.change)));

  parts.push(buildDivider("-", COLS));

  if (d.footer) {
    parts.push(
      COMMANDS.align.center,
      buildText(d.footer),
    );
  }

  parts.push(COMMANDS.feedLines(3), COMMANDS.cut);
  return seq(...parts);
}

// ─── Template 2: Sticker Label ────────────────────────────────────────────────

export function stickerLabel(d: StickerLabelData): Uint8Array {
  const parts: (Uint8Array | readonly number[] | number[])[] = [
    COMMANDS.init,
    COMMANDS.align.center,
    COMMANDS.bold.on,
    buildText(d.title),
    COMMANDS.bold.off,
    buildQRCode(d.qrData, d.qrSize ?? 5),
  ];

  if (d.line1) parts.push(buildText(d.line1));
  if (d.line2) parts.push(buildText(d.line2));
  if (d.line3) parts.push(buildText(d.line3));
  if (d.barcode) parts.push(buildBarcode(d.barcode, d.barcodeType ?? "CODE39"));
  if (d.footer) parts.push(buildText(d.footer));

  parts.push(COMMANDS.feedLines(2), COMMANDS.cut);
  return seq(...parts);
}

// ─── Template 3: ID Badge ─────────────────────────────────────────────────────

export function idBadge(d: IdBadgeData): Uint8Array {
  const parts: (Uint8Array | readonly number[] | number[])[] = [
    COMMANDS.init,
    COMMANDS.align.center,
    COMMANDS.bold.on,
    COMMANDS.textSize.doubleAll,
    buildText(d.orgName.slice(0, 16)),
    COMMANDS.textSize.normal,
    COMMANDS.bold.off,
    buildText(d.eventName),
    buildDivider("-", COLS),
    COMMANDS.textSize.doubleHeight,
    COMMANDS.bold.on,
    buildText(d.holderName),
    COMMANDS.bold.off,
    COMMANDS.textSize.normal,
    buildText(d.role),
    buildQRCode(d.qrData, 6),
    buildText(`ID: ${d.idNumber}`),
  ];

  if (d.validUntil) parts.push(buildText(`Valid: ${d.validUntil}`));

  parts.push(COMMANDS.feedLines(2), COMMANDS.cut);
  return seq(...parts);
}

// ─── Template 4: Payment Confirmation ────────────────────────────────────────

export function paymentConfirmation(d: PaymentConfirmationData): Uint8Array {
  const parts: (Uint8Array | readonly number[] | number[])[] = [
    COMMANDS.init,
    COMMANDS.align.center,
    COMMANDS.bold.on,
    buildText(d.orgName),
    COMMANDS.bold.off,
    buildText("OFFICIAL RECEIPT"),
    COMMANDS.align.left,
    buildDivider("-", COLS),
    padRow("Ref No:", d.referenceNo),
    padRow("Date:", d.date),
    buildDivider("-", COLS),
    buildText(`Received from: ${d.payerName}`),
    buildText(`Payment for:   ${d.paymentFor}`),
    buildDivider("-", COLS),
    COMMANDS.bold.on,
    padRow("AMOUNT:", `PHP ${fmt2(d.amount)}`),
    COMMANDS.bold.off,
    padRow("Method:", d.paymentMethod),
  ];

  if (d.receivedBy) parts.push(padRow("Received by:", d.receivedBy));

  parts.push(buildDivider("-", COLS));

  if (d.notes) {
    parts.push(
      COMMANDS.align.center,
      buildText(d.notes),
    );
  }

  parts.push(
    COMMANDS.align.center,
    buildQRCode(d.referenceNo, 5),
    COMMANDS.feedLines(3),
    COMMANDS.cut,
  );
  return seq(...parts);
}

// ─── Template 5: Inventory Label ─────────────────────────────────────────────

export function inventoryLabel(d: InventoryLabelData): Uint8Array {
  const parts: (Uint8Array | readonly number[] | number[])[] = [
    COMMANDS.init,
    COMMANDS.align.center,
    COMMANDS.bold.on,
    buildText(d.itemName),
    COMMANDS.bold.off,
  ];

  if (d.category) parts.push(buildText(d.category));

  parts.push(
    COMMANDS.align.left,
    buildDivider("-", COLS),
    padRow("Code:", d.itemCode),
    padRow("Qty:", d.quantity),
    padRow("Location:", d.location),
    padRow("Tagged:", d.dateTagged),
    COMMANDS.align.center,
    buildBarcode(d.barcode, d.barcodeType ?? "CODE128"),
    COMMANDS.feedLines(2),
    COMMANDS.cut,
  );
  return seq(...parts);
}

// ─── Template 6: Custom Label (fully flexible) ───────────────────────────────

export async function customLabel(lines: CustomLine[]): Promise<Uint8Array> {
  const parts: (Uint8Array | readonly number[] | number[])[] = [COMMANDS.init];

  for (const line of lines) {
    switch (line.type) {
      case "text": {
        const alignCmd = { left: COMMANDS.align.left, center: COMMANDS.align.center, right: COMMANDS.align.right };
        const sizeCmd  = { normal: COMMANDS.textSize.normal, double: COMMANDS.textSize.doubleHeight, large: COMMANDS.textSize.doubleAll };
        parts.push(
          alignCmd[line.align ?? "left"],
          line.bold ? COMMANDS.bold.on : COMMANDS.bold.off,
          sizeCmd[line.size ?? "normal"],
          buildText(line.content),
          COMMANDS.bold.off,
          COMMANDS.textSize.normal,
        );
        break;
      }
      case "qr":
        parts.push(COMMANDS.align.center, buildQRCode(line.data, line.size ?? 5));
        break;
      case "barcode":
        parts.push(COMMANDS.align.center, buildBarcode(line.data, line.barcodeType ?? "CODE39"));
        break;
      case "divider":
        parts.push(buildDivider(line.char ?? "-", line.width ?? COLS));
        break;
      case "feed":
        parts.push(COMMANDS.feedLines(line.lines));
        break;
      case "image": {
        const imgBytes = await buildImage(line.dataUrl);
        parts.push(COMMANDS.align.center, imgBytes);
        break;
      }
      case "cut":
        parts.push(COMMANDS.cut);
        break;
    }
  }

  return seq(...parts);
}
