"use client";

/**
 * Web Bluetooth connection manager for GOOJPRT PT-210 and compatible
 * ESC/POS BLE thermal printers.
 *
 * Works only in Chrome/Chromium on Android (and desktop Chrome with BT).
 */

const CHUNK = 128;
const CHUNK_DELAY_MS = 20;

// PT-210 primary GATT service / write-characteristic
const SERVICE_UUID  = "0000ff00-0000-1000-8000-00805f9b34fb";
const CHAR_UUID     = "0000ff02-0000-1000-8000-00805f9b34fb";
// Fallback used by many generic ESC/POS BLE printers
const FB_SERVICE    = "000018f0-0000-1000-8000-00805f9b34fb";
const FB_CHAR       = "00002af1-0000-1000-8000-00805f9b34fb";

export function bluetoothSupported(): boolean {
  return typeof navigator !== "undefined" && "bluetooth" in navigator;
}

async function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export class BluetoothPrinter {
  private device: BluetoothDevice | null = null;
  private char: BluetoothRemoteGATTCharacteristic | null = null;

  async connect(): Promise<void> {
    const device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SERVICE_UUID] }, { services: [FB_SERVICE] }],
      optionalServices: [SERVICE_UUID, FB_SERVICE],
    }).catch(() => {
      // User cancelled picker — try without filter for broader compatibility
      return navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [SERVICE_UUID, FB_SERVICE],
      });
    });

    this.device = device;
    const server = await device.gatt!.connect();

    // Try primary service first, then fallback
    let characteristic: BluetoothRemoteGATTCharacteristic | null = null;
    try {
      const svc = await server.getPrimaryService(SERVICE_UUID);
      characteristic = await svc.getCharacteristic(CHAR_UUID);
    } catch {
      const svc = await server.getPrimaryService(FB_SERVICE);
      characteristic = await svc.getCharacteristic(FB_CHAR);
    }

    this.char = characteristic;
  }

  get connected(): boolean {
    return !!(this.device?.gatt?.connected && this.char);
  }

  async print(data: Uint8Array): Promise<void> {
    if (!this.char) throw new Error("Printer not connected.");
    for (let offset = 0; offset < data.length; offset += CHUNK) {
      const chunk = data.slice(offset, offset + CHUNK);
      await this.char.writeValueWithoutResponse(chunk);
      await delay(CHUNK_DELAY_MS);
    }
  }

  disconnect(): void {
    if (this.device?.gatt?.connected) this.device.gatt.disconnect();
    this.device = null;
    this.char = null;
  }
}
