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
