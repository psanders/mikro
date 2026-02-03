/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { withErrorHandlingAndValidation } from "../utils/index.js";
import { receiptDataSchema, type ReceiptDataInput } from "../schemas/receipt.js";
import { loadPrivateKey, createSignedToken, type ReceiptData } from "./jwt.js";
import { generateQRCode } from "./qrcode.js";
import { loadFonts } from "./fonts.js";
import { createReceiptLayout, RECEIPT_WIDTH, RECEIPT_HEIGHT } from "./receipt-layout.js";

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

function loadBackgroundImage(assetsDir: string): string | null {
  const pngPath = join(assetsDir, "background.png");
  if (existsSync(pngPath)) {
    const content = readFileSync(pngPath);
    const base64 = content.toString("base64");
    return `data:image/png;base64,${base64}`;
  }

  const svgPath = join(assetsDir, "background.svg");
  if (existsSync(svgPath)) {
    const svgContent = readFileSync(svgPath, "utf-8");
    const base64 = Buffer.from(svgContent).toString("base64");
    return `data:image/svg+xml;base64,${base64}`;
  }

  return null;
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
  const backgroundImage = loadBackgroundImage(assetsDir);

  const layout = createReceiptLayout(receiptData, qrCodeDataUrl, backgroundImage);
  const svg = await satori(layout as Parameters<typeof satori>[0], {
    width: RECEIPT_WIDTH,
    height: RECEIPT_HEIGHT,
    fonts: fonts as Parameters<typeof satori>[1]["fonts"]
  });

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: Math.round(RECEIPT_WIDTH * 1.5) }
  });
  const pngBuffer = resvg.render().asPng();

  const WHATSAPP_MAX_SIZE = 5 * 1024 * 1024; // 5MB
  let compressedBuffer = pngBuffer;

  if (pngBuffer.length > WHATSAPP_MAX_SIZE || pngBuffer.length > 2 * 1024 * 1024) {
    compressedBuffer = await sharp(pngBuffer)
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: true
      })
      .toBuffer();

    if (compressedBuffer.length > WHATSAPP_MAX_SIZE) {
      logger?.verbose("image still too large after compression, reducing resolution", {
        size: compressedBuffer.length,
        target: WHATSAPP_MAX_SIZE
      });
      compressedBuffer = await sharp(pngBuffer)
        .resize(RECEIPT_WIDTH, RECEIPT_HEIGHT, {
          fit: "contain",
          withoutEnlargement: true
        })
        .png({
          compressionLevel: 9,
          adaptiveFiltering: true,
          palette: true
        })
        .toBuffer();
    }
  } else {
    compressedBuffer = await sharp(pngBuffer)
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toBuffer();
  }

  const image = compressedBuffer.toString("base64");
  logger?.verbose("receipt generated", {
    loanNumber: receiptData.loanNumber,
    originalSize: pngBuffer.length,
    compressedSize: compressedBuffer.length,
    underLimit: compressedBuffer.length < WHATSAPP_MAX_SIZE
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
