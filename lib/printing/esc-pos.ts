/** ESC/POS byte builder for 57/58mm thermal printers. */

const ESC = 0x1b;
const GS  = 0x1d;

// Latin-extended → ASCII transliteration (Ñ→N, É→E, etc.)
// Thermal printers use ASCII + codepage — UTF-8 multi-byte chars break alignment.
const LATIN_XLAT: Readonly<Record<number, number>> = {
  0xc0:65,0xc1:65,0xc2:65,0xc3:65,0xc4:65,0xc5:65, // À-Å → A
  0xe0:97,0xe1:97,0xe2:97,0xe3:97,0xe4:97,0xe5:97,  // à-å → a
  0xc8:69,0xc9:69,0xca:69,0xcb:69,                   // È-Ë → E
  0xe8:101,0xe9:101,0xea:101,0xeb:101,               // è-ë → e
  0xcc:73,0xcd:73,0xce:73,0xcf:73,                   // Ì-Ï → I
  0xec:105,0xed:105,0xee:105,0xef:105,               // ì-ï → i
  0xd1:78,0xf1:110,                                   // Ñ/ñ → N/n
  0xd2:79,0xd3:79,0xd4:79,0xd5:79,0xd6:79,0xd8:79,  // Ò-Ö,Ø → O
  0xf2:111,0xf3:111,0xf4:111,0xf5:111,0xf6:111,0xf8:111, // ò-ö,ø → o
  0xd9:85,0xda:85,0xdb:85,0xdc:85,                   // Ù-Ü → U
  0xf9:117,0xfa:117,0xfb:117,0xfc:117,               // ù-ü → u
  0xc7:67,0xe7:99,                                    // Ç/ç → C/c
};

function toEscPosBytes(text: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const cp = text.charCodeAt(i);
    out.push(cp < 128 ? cp : (LATIN_XLAT[cp] ?? 0x3f));
  }
  return out;
}

// ─── COMMANDS: ready-to-merge Uint8Array primitives ──────────────────────────

export const COMMANDS = {
  init:           new Uint8Array([0x1B, 0x40]),
  cut:            new Uint8Array([0x1D, 0x56, 0x41, 0x00]),
  feedLines:      (n: number) => new Uint8Array([0x1B, 0x64, n]),
  align: {
    left:         new Uint8Array([0x1B, 0x61, 0x00]),
    center:       new Uint8Array([0x1B, 0x61, 0x01]),
    right:        new Uint8Array([0x1B, 0x61, 0x02]),
  },
  bold: {
    on:           new Uint8Array([0x1B, 0x45, 0x01]),
    off:          new Uint8Array([0x1B, 0x45, 0x00]),
  },
  underline: {
    on:           new Uint8Array([0x1B, 0x2D, 0x01]),
    off:          new Uint8Array([0x1B, 0x2D, 0x00]),
  },
  textSize: {
    normal:       new Uint8Array([0x1D, 0x21, 0x00]),
    doubleHeight: new Uint8Array([0x1D, 0x21, 0x01]),
    doubleWidth:  new Uint8Array([0x1D, 0x21, 0x10]),
    doubleAll:    new Uint8Array([0x1D, 0x21, 0x11]),
  },
  lineSpacing: {
    default:      new Uint8Array([0x1B, 0x32]),
    set:          (n: number) => new Uint8Array([0x1B, 0x33, n]),
  },
};

// ─── Functional builder API ───────────────────────────────────────────────────

// TextEncoder used only for QR/barcode binary payloads — NOT for display text.
const enc = new TextEncoder();

/** Encode text + line feed as Uint8Array. Uses 1-byte-per-char encoding so
 *  padEnd/slice alignment stays correct on the printer. */
export function buildText(text: string): Uint8Array {
  const bytes = toEscPosBytes(text);
  bytes.push(0x0a);
  return new Uint8Array(bytes);
}

/** Repeat `char` × `width` then a line feed. */
export function buildDivider(char = "-", width = 32): Uint8Array {
  return buildText(char.repeat(width));
}

/** ESC/POS QR code sequence (GS ( k). size 1-8, default 5. */
export function buildQRCode(data: string, size = 5): Uint8Array {
  const dataBytes = enc.encode(data);
  const len = dataBytes.length + 3;
  const pL = len & 0xff;
  const pH = (len >> 8) & 0xff;
  return new Uint8Array([
    // Store model 2
    GS, 0x28, 0x6b, 4, 0, 0x31, 0x41, 0x32, 0x00,
    // Store size
    GS, 0x28, 0x6b, 3, 0, 0x31, 0x43, size,
    // ECC level M
    GS, 0x28, 0x6b, 3, 0, 0x31, 0x45, 0x30,
    // Store data
    GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...dataBytes,
    // Print
    GS, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30,
  ]);
}

const BARCODE_TYPE_IDS: Record<string, number> = {
  UPCA:    0x41,
  UPCE:    0x42,
  EAN13:   0x43,
  EAN8:    0x44,
  CODE39:  0x45,
  ITF:     0x46,
  CODABAR: 0x47,
  CODE93:  0x48,
  CODE128: 0x49,
};

/** ESC/POS barcode (GS k). Supported: CODE39, CODE128, EAN13, EAN8, UPCA, UPCE. */
export function buildBarcode(data: string, type = "CODE39"): Uint8Array {
  const typeId = BARCODE_TYPE_IDS[type.toUpperCase()] ?? BARCODE_TYPE_IDS.CODE39;
  const dataBytes = enc.encode(data);
  return new Uint8Array([
    GS, 0x68, 80,       // height: 80 dots
    GS, 0x77, 2,        // width multiplier: 2
    GS, 0x48, 0x02,     // HRI text: below barcode
    GS, 0x6b, typeId, dataBytes.length, ...dataBytes,
  ]);
}

/**
 * Convert a base64 image (PNG/JPG) to ESC/POS raster bitmap (GS v 0).
 * Resizes to 384px wide (58mm @ 203dpi) and converts to 1-bit monochrome.
 * Browser-only — requires canvas API.
 */
export async function buildImage(imageDataUrl: string): Promise<Uint8Array> {
  if (typeof document === "undefined") {
    throw new Error("buildImage requires a browser environment (canvas API).");
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const PRINTER_WIDTH = 384;
      const w = PRINTER_WIDTH;
      const h = Math.round(img.height * (PRINTER_WIDTH / img.width));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      const px = ctx.getImageData(0, 0, w, h).data;
      const wBytes = Math.ceil(w / 8);
      const raster: number[] = [];

      for (let y = 0; y < h; y++) {
        for (let bx = 0; bx < wBytes; bx++) {
          let byte = 0;
          for (let bit = 0; bit < 8; bit++) {
            const x = bx * 8 + bit;
            if (x < w) {
              const i = (y * w + x) * 4;
              const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
              if (lum < 128) byte |= (0x80 >> bit);
            }
          }
          raster.push(byte);
        }
      }

      const wL = wBytes & 0xff, wH = (wBytes >> 8) & 0xff;
      const hL = h & 0xff,      hH = (h >> 8) & 0xff;
      resolve(new Uint8Array([GS, 0x76, 0x30, 0x00, wL, wH, hL, hH, ...raster]));
    };
    img.onerror = () => reject(new Error("Failed to load image for printing."));
    img.src = imageDataUrl;
  });
}

/** Concatenate any number of Uint8Array or plain number arrays into one Uint8Array. */
export function mergeCommands(...arrays: (Uint8Array | readonly number[] | number[])[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a instanceof Uint8Array ? a : new Uint8Array(a), offset);
    offset += a.length;
  }
  return out;
}

// ─── Class API — kept for backward compatibility with format-folio.ts ─────────

/** Column width for 57/58mm printers at normal font (32 chars per line). */
export const COLS = 32;

export class EscPos {
  private buf: number[] = [];

  init(): this { this.buf.push(ESC, 0x40); return this; }

  align(a: "left" | "center" | "right"): this {
    const n = a === "left" ? 0 : a === "center" ? 1 : 2;
    this.buf.push(ESC, 0x61, n);
    return this;
  }

  bold(on: boolean): this { this.buf.push(ESC, 0x45, on ? 1 : 0); return this; }

  underline(on: boolean): this { this.buf.push(ESC, 0x2D, on ? 1 : 0); return this; }

  doubleHeight(on: boolean): this { this.buf.push(GS, 0x21, on ? 0x01 : 0x00); return this; }

  textSize(s: "normal" | "doubleHeight" | "doubleWidth" | "doubleAll"): this {
    const m: Record<string, number> = { normal: 0x00, doubleHeight: 0x01, doubleWidth: 0x10, doubleAll: 0x11 };
    this.buf.push(GS, 0x21, m[s]);
    return this;
  }

  text(s: string): this {
    for (const b of toEscPosBytes(s)) this.buf.push(b);
    return this;
  }

  lf(n = 1): this { for (let i = 0; i < n; i++) this.buf.push(0x0a); return this; }

  separator(char = "-"): this { return this.text(char.repeat(COLS)).lf(); }

  /** Left label + right value on one COLS-wide line. */
  row(label: string, value: string): this {
    const maxLabel = COLS - value.length - 1;
    const l = label.slice(0, maxLabel).padEnd(maxLabel);
    return this.text(l + " " + value).lf();
  }

  centered(s: string): this {
    const pad = Math.max(0, Math.floor((COLS - s.length) / 2));
    return this.text(" ".repeat(pad) + s).lf();
  }

  qr(url: string, size = 6): this {
    const data = [...url].map((c) => c.charCodeAt(0));
    const len = data.length + 3;
    const pL = len & 0xff, pH = (len >> 8) & 0xff;
    this.buf.push(
      GS, 0x28, 0x6b, 4, 0, 0x31, 0x41, 0x32, 0x00,
      GS, 0x28, 0x6b, 3, 0, 0x31, 0x43, size,
      GS, 0x28, 0x6b, 3, 0, 0x31, 0x45, 0x30,
      GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...data,
      GS, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30,
    );
    return this;
  }

  cut(): this { this.buf.push(GS, 0x56, 0x41, 0x00); return this; }

  bytes(): Uint8Array { return new Uint8Array(this.buf); }
}
