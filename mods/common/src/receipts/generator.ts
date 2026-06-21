/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { withErrorHandlingAndValidation } from "../utils/index.js";
import { receiptDataSchema, type ReceiptDataInput } from "../schemas/receipt.js";
import { loadPrivateKey, createSignedToken, type ReceiptData } from "./jwt.js";
import { generateQRCode } from "./qrcode.js";
import { loadFonts } from "./fonts.js";
import { createReceiptLayout, RECEIPT_WIDTH } from "./receipt-layout.js";
import { createReceiptCardLayout, CARD_WIDTH, CARD_HEIGHT } from "./receipt-card-layout.js";

/**
 * Response from receipt generation.
 */
export interface GenerateReceiptResponse {
  /** Base64-encoded PNG image */
  image: string;
  /** JWT token for verification */
  token: string;
  /** Receipt metadata */
  receiptData: ReceiptData;
}

/**
 * Optional logger for receipt generation.
 */
export interface ReceiptLogger {
  verbose(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Dependencies for generating a receipt from data (no database).
 * keysDir and assetsDir must be provided by the caller.
 */
export interface CreateGenerateReceiptFromDataDeps {
  keysDir: string;
  assetsDir: string;
  logger?: ReceiptLogger;
}

/**
 * Renders receipt data to a PNG image and JWT. No database access.
 */
export async function renderReceiptToImage(
  receiptData: ReceiptData,
  keysDir: string,
  assetsDir: string,
  logger?: ReceiptLogger
): Promise<GenerateReceiptResponse> {
  const privateKey = loadPrivateKey(keysDir);
  const token = createSignedToken(receiptData, privateKey);
  const qrCodeDataUrl = await generateQRCode(token);
  const fonts = await loadFonts();

  const layout = createReceiptLayout(receiptData, qrCodeDataUrl);

  let fieldCount = 6;
  if (receiptData.principalAmount) fieldCount++;
  if (receiptData.feePaid) fieldCount++;
  if (receiptData.totalPaid) fieldCount++;
  if (receiptData.agentName) fieldCount++;
  const receiptHeight = 280 + fieldCount * 24 + (qrCodeDataUrl ? 160 : 0);

  const svg = await satori(layout as Parameters<typeof satori>[0], {
    width: RECEIPT_WIDTH,
    height: receiptHeight,
    fonts: fonts as Parameters<typeof satori>[1]["fonts"]
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: RECEIPT_WIDTH * 2 }
  });
  const pngBuffer = resvg.render().asPng();

  const compressedBuffer = await sharp(pngBuffer)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  const image = compressedBuffer.toString("base64");
  logger?.verbose("receipt generated", {
    loanNumber: receiptData.loanNumber,
    originalSize: pngBuffer.length,
    compressedSize: compressedBuffer.length
  });
  return { image, token, receiptData };
}

/**
 * Render the landscape receipt card (1125×600) for a GIVEN token. The QR encodes
 * the provided token, so this never signs a new one — use it to re-render a
 * receipt from a token received over the wire (e.g. the public /r/:token route)
 * with no database access.
 *
 * @param receiptData - Fields to render (typically decoded from the token)
 * @param token - The signed token to encode in the QR; pass null to render unsigned
 */
export async function renderReceiptCardWithToken(
  receiptData: ReceiptData,
  token: string | null,
  logger?: ReceiptLogger
): Promise<Buffer> {
  const qrCodeDataUrl = token ? await generateQRCode(token) : null;
  const fonts = await loadFonts();

  const layout = createReceiptCardLayout(receiptData, qrCodeDataUrl);

  const svg = await satori(layout as Parameters<typeof satori>[0], {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    fonts: fonts as Parameters<typeof satori>[1]["fonts"]
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: CARD_WIDTH * 2 }
  });
  const pngBuffer = resvg.render().asPng();

  const compressedBuffer = await sharp(pngBuffer)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  logger?.verbose("receipt card rendered", {
    loanNumber: receiptData.loanNumber,
    originalSize: pngBuffer.length,
    compressedSize: compressedBuffer.length
  });
  return compressedBuffer;
}

/**
 * Render the landscape receipt card and sign a fresh verification token.
 * Mirrors {@link renderReceiptToImage} but produces the WhatsApp-template-sized
 * card (1125×600) instead of the thermal layout.
 */
export async function renderReceiptCardToImage(
  receiptData: ReceiptData,
  keysDir: string,
  logger?: ReceiptLogger
): Promise<GenerateReceiptResponse> {
  const privateKey = loadPrivateKey(keysDir);
  const token = createSignedToken(receiptData, privateKey);
  const compressedBuffer = await renderReceiptCardWithToken(receiptData, token, logger);
  return { image: compressedBuffer.toString("base64"), token, receiptData };
}

/**
 * Creates a function to generate a receipt from manual data (no database).
 * Use this for interactive/manual receipt creation (e.g. from the CLI).
 *
 * @param deps - keysDir and assetsDir (required); optional logger
 * @returns A validated function that generates a receipt from ReceiptDataInput
 */
export function createGenerateReceiptFromData(deps: CreateGenerateReceiptFromDataDeps) {
  const { keysDir, assetsDir, logger } = deps;

  const fn = async (params: ReceiptDataInput): Promise<GenerateReceiptResponse> => {
    logger?.verbose("generating receipt from data", { loanNumber: params.loanNumber });
    const receiptData: ReceiptData = {
      loanNumber: params.loanNumber,
      name: params.name,
      date: params.date,
      amountPaid: params.amountPaid,
      pendingPayments: params.pendingPayments,
      paymentNumber: params.paymentNumber,
      agentName: params.agentName
    };
    return renderReceiptToImage(receiptData, keysDir, assetsDir, logger);
  };

  return withErrorHandlingAndValidation(fn, receiptDataSchema);
}
