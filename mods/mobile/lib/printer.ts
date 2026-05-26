/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Bluetooth thermal receipt printer (58mm ESC/POS).
 * Requires react-native-ble-plx and a development build to function.
 */
import { Alert, Platform } from "react-native";

const LINE_WIDTH = 32;

const ESC = 0x1b;
const GS = 0x1d;

const CMD = {
  INIT: [ESC, 0x40],
  CENTER: [ESC, 0x61, 0x01],
  LEFT: [ESC, 0x61, 0x00],
  BOLD_ON: [ESC, 0x45, 0x01],
  BOLD_OFF: [ESC, 0x45, 0x00],
  DOUBLE_HEIGHT: [ESC, 0x21, 0x10],
  NORMAL_SIZE: [ESC, 0x21, 0x00],
  FEED_CUT: [GS, 0x56, 0x41, 0x03],
  FEED_LINES: (n: number) => [ESC, 0x64, n]
} as const;

export interface PrintReceiptData {
  loanId: string;
  customerName: string;
  date: string;
  cuota: number;
  mora: number;
  total: number;
  method: string;
  installmentNumber?: number;
  termLength?: number;
  collectorName?: string;
}

function text(s: string): number[] {
  return Array.from(new TextEncoder().encode(s));
}

function line(s: string): number[] {
  return [...text(s), 0x0a];
}

function pad(label: string, value: string): string {
  const gap = LINE_WIDTH - label.length - value.length;
  return label + " ".repeat(Math.max(1, gap)) + value;
}

function divider(char = "-"): string {
  return char.repeat(LINE_WIDTH);
}

function formatRD(amount: number): string {
  return `RD$${amount.toLocaleString("es-DO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildReceiptBytes(data: PrintReceiptData): Uint8Array {
  const bytes: number[] = [];
  const push = (...b: number[]) => bytes.push(...b);

  push(...CMD.INIT);
  push(...CMD.CENTER);
  push(...CMD.BOLD_ON);
  push(...CMD.DOUBLE_HEIGHT);
  push(...line("MIKRO CREDITOS"));
  push(...CMD.NORMAL_SIZE);
  push(...CMD.BOLD_OFF);
  push(...line(divider("=")));
  push(...CMD.LEFT);

  push(...line(`Prestamo: #${data.loanId}`));
  push(...line(`Cliente: ${data.customerName}`));
  push(...line(`Fecha: ${data.date}`));
  push(...line(""));

  if (data.mora > 0) {
    push(...line(pad("Cuota:", formatRD(data.cuota))));
    push(...line(pad("Mora:", formatRD(data.mora))));
    push(...line(divider()));
    push(...CMD.BOLD_ON);
    push(...line(pad("TOTAL:", formatRD(data.total))));
    push(...CMD.BOLD_OFF);
  } else {
    push(...CMD.BOLD_ON);
    push(...line(pad("TOTAL:", formatRD(data.total))));
    push(...CMD.BOLD_OFF);
  }

  push(...line(""));
  push(...line(pad("Metodo:", data.method)));

  if (data.installmentNumber != null && data.termLength != null) {
    push(...line(pad("Cuota:", `${data.installmentNumber} de ${data.termLength}`)));
  }

  if (data.collectorName) {
    push(...line(pad("Cobrador:", data.collectorName)));
  }

  push(...line(divider("=")));
  push(...CMD.CENTER);
  push(...CMD.BOLD_ON);
  push(...line("Gracias por su pago!"));
  push(...CMD.BOLD_OFF);
  push(...line("www.mikro.do"));
  push(...CMD.FEED_LINES(4));
  push(...CMD.FEED_CUT);

  return new Uint8Array(bytes);
}

type BleManager = {
  startDeviceScan: (
    uuids: null,
    opts: null,
    cb: (err: unknown, device: BleDevice | null) => void
  ) => void;
  stopDeviceScan: () => void;
  connectToDevice: (id: string) => Promise<BleDevice>;
  destroy: () => void;
};

type BleDevice = {
  id: string;
  name: string | null;
  localName: string | null;
  discoverAllServicesAndCharacteristics: () => Promise<BleDevice>;
  characteristicsForService: (serviceUUID: string) => Promise<Array<{
    uuid: string;
    isWritableWithResponse: boolean;
    isWritableWithoutResponse: boolean;
  }> | null>;
  services: () => Promise<Array<{ uuid: string }> | null>;
  writeCharacteristicWithResponseForService: (
    svc: string,
    char: string,
    value: string
  ) => Promise<unknown>;
  cancelConnection: () => Promise<void>;
};

let cachedManager: BleManager | null = null;

async function getBleManager(): Promise<BleManager> {
  if (cachedManager) return cachedManager;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { BleManager } = require("react-native-ble-plx");
    cachedManager = new BleManager() as BleManager;
    return cachedManager;
  } catch {
    throw new Error(
      "react-native-ble-plx is not installed. A development build is required for Bluetooth printing."
    );
  }
}

const PRINTER_SERVICE_UUID = "000018f0-0000-1000-8000-00805f9b34fb";
const CHUNK_SIZE = 20;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function findWritableCharacteristic(device: BleDevice) {
  const services = await device.services();
  if (!services) throw new Error("No services found on device");

  for (const svc of services) {
    const chars = await device.characteristicsForService(svc.uuid);
    if (!chars) continue;
    for (const c of chars) {
      if (c.isWritableWithResponse || c.isWritableWithoutResponse) {
        return { serviceUUID: svc.uuid, characteristicUUID: c.uuid };
      }
    }
  }
  throw new Error("No writable characteristic found");
}

async function writeToDevice(device: BleDevice, data: Uint8Array): Promise<void> {
  let target: { serviceUUID: string; characteristicUUID: string };
  try {
    const chars = await device.characteristicsForService(PRINTER_SERVICE_UUID);
    const writable = chars?.find((c) => c.uuid.toLowerCase().includes("2af1"));
    if (writable) {
      target = { serviceUUID: PRINTER_SERVICE_UUID, characteristicUUID: writable.uuid };
    } else {
      target = await findWritableCharacteristic(device);
    }
  } catch {
    target = await findWritableCharacteristic(device);
  }

  for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
    const chunk = data.slice(offset, offset + CHUNK_SIZE);
    const b64 = toBase64(chunk);
    await device.writeCharacteristicWithResponseForService(
      target.serviceUUID,
      target.characteristicUUID,
      b64
    );
  }
}

export async function scanForPrinters(
  timeoutMs = 8000
): Promise<Array<{ id: string; name: string }>> {
  const manager = await getBleManager();
  const printers: Array<{ id: string; name: string }> = [];
  const seen = new Set<string>();

  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      manager.stopDeviceScan();
      resolve(printers);
    }, timeoutMs);

    manager.startDeviceScan(null, null, (err, device) => {
      if (err || !device) return;
      const name = device.localName ?? device.name;
      if (!name || seen.has(device.id)) return;
      const lower = name.toLowerCase();
      if (
        lower.includes("print") ||
        lower.includes("pos") ||
        lower.includes("thermal") ||
        lower.includes("mtp")
      ) {
        seen.add(device.id);
        printers.push({ id: device.id, name });
      }
    });

    if (timeoutMs > 0) {
      // Already handled by timer
    } else {
      clearTimeout(timer);
      setTimeout(() => {
        manager.stopDeviceScan();
        resolve(printers);
      }, 5000);
    }
  });
}

export async function printReceipt(deviceId: string, data: PrintReceiptData): Promise<void> {
  const manager = await getBleManager();
  const receiptBytes = buildReceiptBytes(data);

  const device = await manager.connectToDevice(deviceId);
  try {
    await device.discoverAllServicesAndCharacteristics();
    await writeToDevice(device, receiptBytes);
  } finally {
    try {
      await device.cancelConnection();
    } catch {
      // ignore disconnect errors
    }
  }
}

export function requestBluetoothPermission(): Promise<boolean> {
  if (Platform.OS === "android") {
    // Android 12+ requires BLUETOOTH_CONNECT and BLUETOOTH_SCAN
    // This is handled by react-native-ble-plx automatically on most versions
    return Promise.resolve(true);
  }
  // iOS: Bluetooth permission is requested automatically on first scan
  return Promise.resolve(true);
}

export async function printReceiptWithUI(data: PrintReceiptData): Promise<void> {
  try {
    await requestBluetoothPermission();
    const printers = await scanForPrinters();

    if (printers.length === 0) {
      Alert.alert(
        "No se encontró impresora",
        "Enciende la impresora Bluetooth y asegúrate que esté cerca del teléfono.",
        [{ text: "OK" }]
      );
      return;
    }

    if (printers.length === 1) {
      await printReceipt(printers[0].id, data);
      return;
    }

    // Multiple printers — use the first one found
    // TODO: let user pick from a list
    await printReceipt(printers[0].id, data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    Alert.alert("Error de impresión", msg);
  }
}
