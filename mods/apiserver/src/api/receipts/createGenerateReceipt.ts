/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import {
  withErrorHandlingAndValidation,
  generateReceiptSchema,
  type GenerateReceiptInput,
  type DbClient
} from "@mikro/common";
import {
  loadPrivateKey,
  createSignedToken,
  generateQRCode,
  loadFonts,
  createReceiptLayout,
  RECEIPT_WIDTH,
  RECEIPT_HEIGHT,
  type ReceiptData
} from "../../receipts/index.js";
import { logger } from "../../logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APISERVER_ROOT = join(__dirname, "../../../");
const PROJECT_ROOT = join(APISERVER_ROOT, "../../");

/**
 * Get the keys directory path.
 * Uses MIKRO_KEYS_PATH env var if set, otherwise defaults to PROJECT_ROOT/.keys for development.
 */
function getKeysDir(): string {
  const keysPath = process.env.MIKRO_KEYS_PATH;
  if (keysPath) {
    return keysPath;
  }
  // Default to project root .keys folder for development
  return join(PROJECT_ROOT, ".keys");
}

/**
 * Response from generateReceipt.
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
 * Dependencies for receipt generation.
 */
export interface ReceiptDependencies {
  db: DbClient;
  keysDir?: string;
  assetsDir?: string;
}

/**
 * Load background image as base64 data URL.
 */
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
 * Creates a function to generate a payment receipt as a PNG image.
 *
 * @param deps - Dependencies including database client and optional directories
 * @returns A validated function that generates a receipt
 */
export function createGenerateReceipt(deps: ReceiptDependencies) {
  const { db, keysDir = getKeysDir(), assetsDir = join(APISERVER_ROOT, "assets") } = deps;

  const fn = async (params: GenerateReceiptInput): Promise<GenerateReceiptResponse> => {
    logger.verbose("generating receipt", { paymentId: params.paymentId });

    // 1. Fetch Payment with Loan and Member
    const payment = await db.payment.findUnique({
      where: { id: params.paymentId },
      include: {
        loan: {
          include: {
            member: true,
            payments: {
              where: { status: "COMPLETED" },
              orderBy: { paidAt: "asc" }
            }
          }
        },
        collectedBy: true
      }
    });

    if (!payment) {
      throw new Error(`Payment not found: ${params.paymentId}`);
    }

    const { loan } = payment;
    const { member, payments: allPayments } = loan;

    // 2. Calculate payment number and pending payments
    const paymentIndex = allPayments.findIndex((p) => p.id === payment.id);
    const paymentNumber = paymentIndex >= 0 ? paymentIndex + 1 : allPayments.length;
    const pendingPayments = loan.termLength - paymentNumber;

    // 3. Build receipt data
    const receiptData: ReceiptData = {
      loanNumber: String(loan.loanId),
      name: member.name,
      date: payment.paidAt.toLocaleDateString("es-DO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }),
      amountPaid: `RD$ ${Number(payment.amount).toLocaleString("es-DO")}`,
      pendingPayments: Math.max(0, pendingPayments),
      paymentNumber: `P${paymentNumber}`,
      agentName: payment.collectedBy?.name
    };

    // 4. Load private key and create signed JWT
    const privateKey = loadPrivateKey(keysDir);
    const token = createSignedToken(receiptData, privateKey);

    // 5. Generate QR code from token
    const qrCodeDataUrl = await generateQRCode(token);

    // 6. Load fonts and background
    const fonts = await loadFonts();
    const backgroundImage = loadBackgroundImage(assetsDir);

    // 7. Generate SVG with Satori
    const layout = createReceiptLayout(receiptData, qrCodeDataUrl, backgroundImage);
    // Cast layout to satisfy Satori's ReactNode type requirement
    const svg = await satori(layout as Parameters<typeof satori>[0], {
      width: RECEIPT_WIDTH,
      height: RECEIPT_HEIGHT,
      fonts: fonts as Parameters<typeof satori>[1]["fonts"]
    });

    // 8. Convert to PNG with resvg
    // Use 1.5x resolution instead of 2x to reduce file size for WhatsApp (5MB limit)
    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: Math.round(RECEIPT_WIDTH * 1.5) }
    });
    const pngBuffer = resvg.render().asPng();

    // 9. Compress PNG to ensure it's under WhatsApp's 5MB limit (5 * 1024 * 1024 bytes)
    const WHATSAPP_MAX_SIZE = 5 * 1024 * 1024; // 5MB
    let compressedBuffer = pngBuffer;

    // If original is already under limit, still compress for optimization
    if (pngBuffer.length > WHATSAPP_MAX_SIZE || pngBuffer.length > 2 * 1024 * 1024) {
      // Aggressive compression needed - try palette mode for smaller files
      compressedBuffer = await sharp(pngBuffer)
        .png({
          compressionLevel: 9, // Maximum compression
          adaptiveFiltering: true,
          palette: true // Use palette mode for smaller file size
        })
        .toBuffer();

      // If still too large, try reducing resolution further
      if (compressedBuffer.length > WHATSAPP_MAX_SIZE) {
        logger.verbose("image still too large after compression, reducing resolution", {
          size: compressedBuffer.length,
          target: WHATSAPP_MAX_SIZE
        });
        // Resize to 1x (original receipt size) and compress again
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
      // Light compression for optimization
      compressedBuffer = await sharp(pngBuffer)
        .png({
          compressionLevel: 9, // Maximum compression
          adaptiveFiltering: true
        })
        .toBuffer();
    }

    const image = compressedBuffer.toString("base64");

    logger.verbose("receipt generated", {
      paymentId: params.paymentId,
      loanId: loan.loanId,
      originalSize: pngBuffer.length,
      compressedSize: compressedBuffer.length,
      sizeReduction: `${((1 - compressedBuffer.length / pngBuffer.length) * 100).toFixed(1)}%`,
      underLimit: compressedBuffer.length < WHATSAPP_MAX_SIZE
    });
    return {
      image,
      token,
      receiptData
    };
  };

  return withErrorHandlingAndValidation(fn, generateReceiptSchema);
}
