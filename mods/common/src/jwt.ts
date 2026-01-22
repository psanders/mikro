import jwt from 'jsonwebtoken';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Load private key for signing
 */
export function loadPrivateKey(keysDir: string): string {
  const keyPath = join(keysDir, 'private.pem');
  if (!existsSync(keyPath)) {
    throw new Error(`Private key not found at ${keyPath}. Run the key generation command first.`);
  }
  
  return readFileSync(keyPath, 'utf-8');
}

export interface LoanData {
  loanNumber?: string;
  firstName?: string;
  lastName?: string;
  date?: string;
  amountPaid?: string;
  pendingPayments?: number;
  paymentNumber?: string;
  agentName?: string;
  [key: string]: unknown;
}

/**
 * Create signed JWT from loan data
 */
export function createSignedToken(loanData: LoanData, privateKey: string): string {
  const payload = {
    ...loanData,
    iat: Math.floor(Date.now() / 1000),
    iss: 'mikro',
  };
  
  return jwt.sign(payload, privateKey, {
    algorithm: 'RS256',
    expiresIn: '1y', // Token valid for 1 year
  });
}
