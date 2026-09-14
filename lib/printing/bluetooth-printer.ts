"use client";

/**
 * Web Bluetooth transport for GOOJPRT PT-265 and compatible ESC/POS BLE printers.
 * Chrome/Edge only — Android, Windows, and macOS.
 */

// PT-265 / generic ESC/POS BLE (primary)
const SERVICE_UUID = "000018f0-0000-1000-8000-00805f9b34fb";
const CHAR_UUID    = "00002af1-0000-1000-8000-00805f9b34fb";
// PT-210 and other variants (fallback)
const FB_SERVICE   = "0000ff00-0000-1000-8000-00805f9b34fb";
const FB_CHAR      = "0000ff02-0000-1000-8000-00805f9b34fb";

const CHUNK          = 128;
const CHUNK_DELAY_MS = 100;

export type PrintResult   = { success: boolean; error?: string };
export type ConnectResult = { success: boolean; deviceName: string; error?: string };

export function bluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

async function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

async function resolveChar(
  server: BluetoothRemoteGATTServer,
): Promise<BluetoothRemoteGATTCharacteristic> {
  try {
    const svc = await server.getPrimaryService(SERVICE_UUID);
    return await svc.getCharacteristic(CHAR_UUID);
  } catch {
    try {
      const svc = await server.getPrimaryService(FB_SERVICE);
      return await svc.getCharacteristic(FB_CHAR);
    } catch {
      // Log all services so the developer can identify the right UUIDs
      try {
        const svcs = await server.getPrimaryServices();
        console.info("[printer] Available services:", svcs.map((s) => s.uuid));
      } catch { /* ignore */ }
      throw new Error("No writable characteristic found. Check console for available service UUIDs.");
    }
  }
}

// ─── Module-level functional API ─────────────────────────────────────────────

let _device: BluetoothDevice | null = null;
let _char: BluetoothRemoteGATTCharacteristic | null = null;

export async function connectPrinter(): Promise<ConnectResult> {
  try {
    let device: BluetoothDevice;
    try {
      device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }, { services: [FB_SERVICE] }],
        optionalServices: [SERVICE_UUID, FB_SERVICE],
      });
    } catch {
      // Filtered request failed or user cancelled — try open picker
      device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [SERVICE_UUID, FB_SERVICE],
      });
    }
    _device = device;
    const server = await device.gatt!.connect();
    _char = await resolveChar(server);
    return { success: true, deviceName: device.name ?? "Printer" };
  } catch (e) {
    _device = null;
    _char = null;
    return { success: false, deviceName: "", error: e instanceof Error ? e.message : String(e) };
  }
}

export function disconnectPrinter(): void {
  if (_device?.gatt?.connected) _device.gatt.disconnect();
  _device = null;
  _char = null;
}

export function isPrinterConnected(): boolean {
  return !!(_device?.gatt?.connected && _char);
}

export async function sendBytes(data: Uint8Array): Promise<PrintResult> {
  if (!_char) return { success: false, error: "Printer not connected." };
  try {
    for (let offset = 0; offset < data.length; offset += CHUNK) {
      await _char.writeValueWithoutResponse(data.slice(offset, offset + CHUNK));
      await sleep(CHUNK_DELAY_MS);
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : String(e) };
  }
}

export function getPrinterStatus(): { connected: boolean; deviceName: string | null } {
  return { connected: isPrinterConnected(), deviceName: _device?.name ?? null };
}

// ─── Class API — backward-compat for format-folio.ts and hotel UI ─────────────

export class BluetoothPrinter {
  private device: BluetoothDevice | null = null;
  private char: BluetoothRemoteGATTCharacteristic | null = null;

  async connect(): Promise<void> {
    let device: BluetoothDevice;
    try {
      device = await navigator.bluetooth.requestDevice({
        filters: [{ services: [SERVICE_UUID] }, { services: [FB_SERVICE] }],
        optionalServices: [SERVICE_UUID, FB_SERVICE],
      });
    } catch {
      device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [SERVICE_UUID, FB_SERVICE],
      });
    }
    this.device = device;
    this.char = await resolveChar(await device.gatt!.connect());
  }

  get connected(): boolean {
    return !!(this.device?.gatt?.connected && this.char);
  }

  async print(data: Uint8Array): Promise<void> {
    if (!this.char) throw new Error("Printer not connected.");
    for (let offset = 0; offset < data.length; offset += CHUNK) {
      await this.char.writeValueWithoutResponse(data.slice(offset, offset + CHUNK));
      await sleep(CHUNK_DELAY_MS);
    }
  }

  disconnect(): void {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
    this.device = null;
    this.char = null;
  }
}
