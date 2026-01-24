/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import jwt from "jsonwebtoken";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Load private key for signing from the keys directory.
 */
export function loadPrivateKey(keysDir: string): string {
  const keyPath = join(keysDir, "private.pem");
  if (!existsSync(keyPath)) {
    throw new Error(
      `Private key not found at ${keyPath}. Run the key generation command first.`
    );
  }

  return readFileSync(keyPath, "utf-8");
}

/**
 * Receipt data for JWT payload.
 */
export interface ReceiptData {
  loanNumber: string;
  name: string;
  date: string;
  amountPaid: string;
  pendingPayments: number;
  paymentNumber: string;
  agentName?: string;
}

/**
 * Create signed JWT from receipt data.
 */
export function createSignedToken(
  receiptData: ReceiptData,
  privateKey: string
): string {
  const payload = {
    ...receiptData,
    iat: Math.floor(Date.now() / 1000),
    iss: "mikro",
  };

  return jwt.sign(payload, privateKey, {
    algorithm: "RS256",
    expiresIn: "1y", // Token valid for 1 year
  });
}
