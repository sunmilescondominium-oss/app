/** ESC/POS byte builder for 57mm thermal printers (48 chars wide). */

const ESC = 0x1b;
const GS  = 0x1d;

export const COLS = 48;

export class EscPos {
  private buf: number[] = [];

  init(): this {
    this.buf.push(ESC, 0x40);
    return this;
  }

  align(a: "left" | "center" | "right"): this {
    const n = a === "left" ? 0 : a === "center" ? 1 : 2;
    this.buf.push(ESC, 0x61, n);
    return this;
  }

  bold(on: boolean): this {
    this.buf.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  doubleHeight(on: boolean): this {
    this.buf.push(ESC, 0x21, on ? 0x10 : 0x00);
    return this;
  }

  text(s: string): this {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      this.buf.push(c < 128 ? c : 0x3f); // replace non-ASCII with '?'
    }
    return this;
  }

  lf(n = 1): this {
    for (let i = 0; i < n; i++) this.buf.push(0x0a);
    return this;
  }

  separator(char = "-"): this {
    return this.text(char.repeat(COLS)).lf();
  }

  /** Left-aligned label + right-aligned value on one 48-char line. */
  row(label: string, value: string): this {
    const maxLabel = COLS - value.length - 1;
    const l = label.slice(0, maxLabel).padEnd(maxLabel);
    return this.text(l + " " + value).lf();
  }

  /** Center a string within COLS. */
  centered(s: string): this {
    const pad = Math.max(0, Math.floor((COLS - s.length) / 2));
    return this.text(" ".repeat(pad) + s).lf();
  }

  /** QR code for a URL (GS ( k command sequence). */
  qr(url: string): this {
    const model = [GS, 0x28, 0x6b, 4, 0, 0x31, 0x41, 0x32, 0x00];
    const size  = [GS, 0x28, 0x6b, 3, 0, 0x31, 0x43, 6];
    const errL  = [GS, 0x28, 0x6b, 3, 0, 0x31, 0x45, 0x30];

    const data = [...url].map((c) => c.charCodeAt(0));
    const len = data.length + 3;
    const pL = len & 0xff;
    const pH = (len >> 8) & 0xff;
    const store = [GS, 0x28, 0x6b, pL, pH, 0x31, 0x50, 0x30, ...data];
    const print = [GS, 0x28, 0x6b, 3, 0, 0x31, 0x51, 0x30];

    this.buf.push(...model, ...size, ...errL, ...store, ...print);
    return this;
  }

  cut(): this {
    this.buf.push(0x1d, 0x56, 0x01);
    return this;
  }

  bytes(): Uint8Array {
    return new Uint8Array(this.buf);
  }
}
