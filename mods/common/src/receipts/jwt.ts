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
    throw new Error(`Private key not found at ${keyPath}. Run the key generation command first.`);
  }

  return readFileSync(keyPath, "utf-8");
}

/**
 * Load public key for verification from the keys directory.
 */
export function loadPublicKey(keysDir: string): string {
  const keyPath = join(keysDir, "public.pem");
  if (!existsSync(keyPath)) {
    throw new Error(`Public key not found at ${keyPath}. Run the key generation command first.`);
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
  /** Original loan principal (amount borrowed). */
  principalAmount?: string;
  amountPaid?: string;
  pendingPayments: number;
  paymentNumber: string;
  method?: string;
  agentName?: string;
  /** Mora collected with this payment (always set for regular payments, even "RD$0.00"). */
  feePaid?: string;
  /** Total cash (installment + mora). Always set when feePaid is set. */
  totalPaid?: string;
}

/**
 * Create signed JWT from receipt data.
 */
export function createSignedToken(receiptData: ReceiptData, privateKey: string): string {
  const payload = {
    ...receiptData,
    iat: Math.floor(Date.now() / 1000),
    iss: "mikro"
  };

  return jwt.sign(payload, privateKey, {
    algorithm: "RS256",
    expiresIn: "1y" // Token valid for 1 year
  });
}

/**
 * Verify a signed receipt token and return its receipt data. Throws if the
 * signature is invalid or the token is expired. The signed payload is
 * self-contained, so callers can render a receipt straight from the token
 * without any database access.
 */
export function verifyReceiptToken(token: string, publicKey: string): ReceiptData {
  const payload = jwt.verify(token, publicKey, { algorithms: ["RS256"] }) as Record<
    string,
    unknown
  >;
  // Strip JWT envelope claims; the rest is the ReceiptData we signed.
  const data = { ...payload };
  delete data.iat;
  delete data.iss;
  delete data.exp;
  delete data.nbf;
  return data as unknown as ReceiptData;
}
