#!/usr/bin/env npx tsx
/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Script to generate RSA key pair for signing receipts.
 * Run with: npm run generate-keys
 */
import { generateKeys } from "@mikro/common";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const KEYS_DIR = join(ROOT_DIR, ".keys");

console.log("Mikro Key Generator");
console.log("===================\n");

const privateKeyPath = join(KEYS_DIR, "private.pem");
const publicKeyPath = join(KEYS_DIR, "public.pem");

if (existsSync(privateKeyPath) || existsSync(publicKeyPath)) {
  console.error(`Keys already exist in ${KEYS_DIR}.`);
  console.error("Delete them first if you want to generate new ones.");
  console.error(`  Private key: ${privateKeyPath}`);
  console.error(`  Public key:  ${publicKeyPath}`);
  process.exit(1);
}

console.log("Generating RSA-2048 key pair...\n");

const { privateKeyPath: generatedPrivatePath, publicKeyPath: generatedPublicPath } =
  generateKeys(KEYS_DIR);

console.log("Keys generated successfully!\n");
console.log(`  Private key: ${generatedPrivatePath}`);
console.log(`  Public key:  ${generatedPublicPath}`);
console.log("\nKeep your private key secure! Do not commit it to version control.");
