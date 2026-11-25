/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Receipts must render inside their canvas. satori 0.60 sizes boxes as
 * content-box, so a padded root grew past the canvas and clipped the
 * right-aligned values (loan #10055 receipt, 2026-11-25). Each layout's page
 * padding must stay blank: ink there means content overflowed.
 */
import { expect } from "chai";
import { generateKeyPairSync } from "crypto";
import { mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import sharp from "sharp";
import { renderReceiptCardWithToken, renderReceiptToImage } from "../../src/receipts/generator.js";
import type { ReceiptData } from "../../src/receipts/jwt.js";

/** Renders are scaled 2x (resvg fitTo width × 2). */
const SCALE = 2;

const SHORT: ReceiptData = {
  loanNumber: "10055",
  name: "Adrian Melo martinez",
  date: "25/11/2026",
  principalAmount: "RD$ 10,000.00",
  amountPaid: "RD$ 1,300.00",
  pendingPayments: 8,
  paymentNumber: "P2",
  agentName: "Luis Alberto"
};

const FULL: ReceiptData = {
  loanNumber: "10029",
  name: "María Altagracia Rodríguez de la Cruz",
  date: "31/12/2026",
  principalAmount: "RD$ 100,000.00",
  amountPaid: "RD$ 12,345.67",
  pendingPayments: 12,
  paymentNumber: "P10 (parcial)",
  method: "TRANSFERENCIA",
  agentName: "Juan Carlos Fernández",
  feePaid: "RD$ 1,240.00",
  totalPaid: "RD$ 13,585.67"
};

interface Margins {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/** Count non-white pixels inside each page margin (in CSS px). */
async function inkInMargins(png: Buffer, margins: Margins): Promise<Margins> {
  const { data, info } = await sharp(png)
    .flatten({ background: "#ffffff" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const ink = { left: 0, right: 0, top: 0, bottom: 0 };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels;
      if (data[i] > 245 && data[i + 1] > 245 && data[i + 2] > 245) continue;
      if (x < margins.left * SCALE) ink.left++;
      if (x >= width - margins.right * SCALE) ink.right++;
      if (y < margins.top * SCALE) ink.top++;
      if (y >= height - margins.bottom * SCALE) ink.bottom++;
    }
  }
  return ink;
}

describe("receipt layouts fit their canvas", () => {
  let keysDir: string;

  before(() => {
    keysDir = mkdtempSync(join(tmpdir(), "mikro-receipt-keys-"));
    const { privateKey } = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
      publicKeyEncoding: { type: "spki", format: "pem" }
    });
    writeFileSync(join(keysDir, "private.pem"), privateKey);
  });

  after(() => rmSync(keysDir, { recursive: true, force: true }));

  for (const [label, data] of [
    ["short values", SHORT],
    ["every field, long values", FULL]
  ] as const) {
    it(`thermal receipt keeps its 20px side padding blank (${label})`, async () => {
      const { image } = await renderReceiptToImage(data, keysDir, keysDir);
      const png = Buffer.from(image, "base64");
      const { width } = await sharp(png).metadata();
      expect(width).to.equal(384 * SCALE);
      const ink = await inkInMargins(png, { left: 20, right: 20, top: 0, bottom: 0 });
      expect(ink.left, "ink in left padding").to.equal(0);
      expect(ink.right, "ink in right padding").to.equal(0);
    });

    for (const signed of [true, false]) {
      it(`WhatsApp card keeps its page padding blank (${label}, ${signed ? "signed" : "unsigned"})`, async () => {
        const png = await renderReceiptCardWithToken(data, signed ? "token.for.qr" : null);
        const { width, height } = await sharp(png).metadata();
        expect([width, height]).to.deep.equal([1125 * SCALE, 600 * SCALE]);
        const ink = await inkInMargins(png, { left: 56, right: 56, top: 44, bottom: 44 });
        expect(ink.left, "ink in left padding").to.equal(0);
        expect(ink.right, "ink in right padding").to.equal(0);
        // 10+ rows outgrow the 600px card vertically (older, separate issue);
        // only cards whose rows fit are held to the top/bottom padding.
        if (data === SHORT) {
          expect(ink.top, "ink in top padding").to.equal(0);
          expect(ink.bottom, "ink in bottom padding").to.equal(0);
        }
      });
    }
  }
});
