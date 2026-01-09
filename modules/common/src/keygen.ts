import { generateKeyPairSync } from 'crypto';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface GeneratedKeys {
  privateKeyPath: string;
  publicKeyPath: string;
}

/**
 * Generate RSA key pair for signing JWTs
 */
export function generateKeys(keysDir: string): GeneratedKeys {
  // Create keys directory if it doesn't exist
  if (!existsSync(keysDir)) {
    mkdirSync(keysDir, { recursive: true });
  }

  const privateKeyPath = join(keysDir, 'private.pem');
  const publicKeyPath = join(keysDir, 'public.pem');

  // Check if keys already exist
  if (existsSync(privateKeyPath) || existsSync(publicKeyPath)) {
    throw new Error(`Keys already exist in ${keysDir}. Delete them first if you want to generate new ones.`);
  }

  // Generate RSA key pair
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem',
    },
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem',
    },
  });

  // Save keys to files
  writeFileSync(privateKeyPath, privateKey);
  writeFileSync(publicKeyPath, publicKey);

  return {
    privateKeyPath,
    publicKeyPath,
  };
}
