# Bluetooth Thermal Printer Module

Reusable BLE printer module for browser-based apps (Chrome/Edge only).
Works with GOOJPRT PT-265 and any compatible ESC/POS BLE thermal printer.

## Files

| File | Purpose |
|---|---|
| `esc-pos.ts` | ESC/POS byte commands — no BLE, no UI |
| `bluetooth-printer.ts` | BLE connection lifecycle |
| `templates.ts` | 6 ready-to-use print templates |
| `../../components/bluetooth-print-button.tsx` | React UI component |

---

## Setup

1. **Pair the printer** — turn on the PT-265, go to your device's Bluetooth settings, and pair it before opening Chrome.
2. **Use HTTPS** — Web Bluetooth requires a secure origin. `localhost` also works.
3. **Browser** — Chrome or Edge only. Firefox, Safari, and iOS Chrome do not support Web Bluetooth.

---

## Template usage

### Template 1: `receipt`

```ts
import { receipt } from "@/lib/printing/templates";
import { sendBytes } from "@/lib/printing/bluetooth-printer";

const bytes = receipt({
  businessName: "Sunrise Store",
  address: "123 Main St",
  receiptNo: "OR-00042",
  date: "Sep 14, 2026  2:30 PM",
  cashier: "Maria Santos",
  items: [
    { name: "Bottled Water 500ml", qty: 3, price: 20 },
    { name: "Bread Loaf",          qty: 1, price: 65 },
  ],
  subtotal: 125,
  discount: 0,
  total: 125,
  paymentMethod: "GCash",
  amountPaid: 125,
  change: 0,
  footer: "Thank you for your purchase!",
});

await sendBytes(bytes);
```

### Template 2: `stickerLabel`

```ts
import { stickerLabel } from "@/lib/printing/templates";

const bytes = stickerLabel({
  title: "FRAGILE — HANDLE WITH CARE",
  qrData: "https://example.com/item/ABC-123",
  qrSize: 5,
  line1: "Item: Gift Box Set",
  line2: "SKU: ABC-123",
  barcode: "ABC123",
  barcodeType: "CODE39",
  footer: "Pack carefully",
});
```

### Template 3: `idBadge`

```ts
import { idBadge } from "@/lib/printing/templates";

const bytes = idBadge({
  orgName: "PAREB",
  eventName: "66th National Convention 2026",
  holderName: "Juan dela Cruz",
  role: "Delegate",
  idNumber: "PAREB-2026-00142",
  qrData: "VOTER:00142:REGION3",
  validUntil: "Oct 10, 2026",
});
```

### Template 4: `paymentConfirmation`

```ts
import { paymentConfirmation } from "@/lib/printing/templates";

const bytes = paymentConfirmation({
  orgName: "Sun Miles Condominium",
  paymentFor: "Annual Dues 2026",
  payerName: "Arnel Malabayabas",
  referenceNo: "DUE-2026-0088",
  amount: 12500,
  paymentMethod: "Bank Transfer",
  date: "Sep 14, 2026",
  receivedBy: "Admin Office",
  notes: "Keep this receipt for your records.",
});
```

### Template 5: `inventoryLabel`

```ts
import { inventoryLabel } from "@/lib/printing/templates";

const bytes = inventoryLabel({
  itemName: "Hand Towel — White",
  itemCode: "HT-WHT-001",
  category: "Linens",
  quantity: "50 pcs",
  location: "Storage B, Shelf 3",
  barcode: "HT-WHT-001",
  barcodeType: "CODE128",
  dateTagged: "Sep 14, 2026",
});
```

### Template 6: `customLabel` (fully flexible)

```ts
import { customLabel } from "@/lib/printing/templates";

const bytes = await customLabel([
  { type: "text",    content: "WELCOME TO SUN MILES", align: "center", bold: true, size: "large" },
  { type: "divider", char: "=", width: 32 },
  { type: "qr",      data: "https://app.sunmilescond.com", size: 6 },
  { type: "text",    content: "Scan to access your account", align: "center" },
  { type: "feed",    lines: 2 },
  { type: "cut" },
]);
```

---

## Using `BluetoothPrintButton` component

```tsx
import { BluetoothPrintButton } from "@/components/bluetooth-print-button";

// Receipt example
<BluetoothPrintButton
  template="receipt"
  data={receiptData}
  buttonLabel="Print Receipt"
  onSuccess={() => toast("Printed!")}
  onError={(err) => console.error(err)}
/>

// ID badge example
<BluetoothPrintButton
  template="idBadge"
  data={badgeData}
  buttonLabel="Print Badge"
/>
```

The component handles all 6 states automatically: disconnected → connecting → idle → printing → success/error.

---

## Using the low-level API directly

```ts
import { connectPrinter, sendBytes, disconnectPrinter, isPrinterConnected } from "@/lib/printing/bluetooth-printer";
import { mergeCommands, COMMANDS, buildText, buildQRCode } from "@/lib/printing/esc-pos";

const result = await connectPrinter();
if (!result.success) { alert(result.error); return; }

const bytes = mergeCommands(
  COMMANDS.init,
  COMMANDS.align.center,
  COMMANDS.bold.on,
  buildText("Hello, Printer!"),
  COMMANDS.bold.off,
  buildQRCode("https://example.com", 5),
  COMMANDS.feedLines(3),
  COMMANDS.cut,
);

await sendBytes(bytes);
```

---

## Browser compatibility

| Browser | Platform | Supported |
|---|---|---|
| Chrome 56+ | Android | ✅ |
| Chrome 70+ | Windows | ✅ |
| Chrome 70+ | macOS | ✅ (with BT adapter) |
| Edge 79+ | Windows | ✅ |
| Firefox | All | ❌ No Web Bluetooth |
| Safari | All | ❌ No Web Bluetooth |
| Chrome | iOS | ❌ iOS WebKit restriction |

---

## Troubleshooting

**Device not appearing in the picker**
- Pair the printer in OS Bluetooth settings first.
- PT-265: power on and make sure it's in pairing mode (steady blue LED).
- Some printers only appear after pairing — they won't show in the picker unpaired.

**"No writable characteristic found" — check console for UUIDs**
- The module tries PT-265 UUIDs first (`000018f0` / `00002af1`), then PT-210 UUIDs (`0000ff00` / `0000ff02`).
- If neither matches, the console will print all available service UUIDs from the printer.
- Update `SERVICE_UUID` and `CHAR_UUID` in `bluetooth-printer.ts` to match what the console shows.

**Chunks failing / printer stops mid-job**
- Try reducing `CHUNK` in `bluetooth-printer.ts` from 512 to 128.
- Increase `CHUNK_DELAY_MS` from 50 to 100 if the printer drops bytes.

**QR code not printing / printing blank**
- Some ESC/POS firmware requires `ESC @` (init) before GS ( k commands. The module always sends init first.
- If still blank, try a smaller QR size (size 3 or 4) — very large QR data may exceed the printer buffer.

**Barcode not printing**
- Verify the data is valid for the barcode type: CODE39 only supports A-Z 0-9 and a few symbols; CODE128 supports full ASCII.
- Try CODE128 for alphanumeric codes with lowercase letters.

**`buildImage` does nothing**
- Requires a browser environment with canvas API. Will throw if called in a Next.js server component.
- Only call `buildImage` or `customLabel` with `{ type: "image" }` from client components.
