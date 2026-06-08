/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { getConfig, resolvePathFromConfigDir, MAX_ATTACHMENT_SIZE_BYTES } from "@mikro/common";
import { logger } from "../logger.js";

export interface SavedContract {
  filename: string;
  size: number;
  sha256: string;
  absolutePath: string;
}

/**
 * Absolute directory for signed contract PDFs, created on demand.
 */
export function getContractsDir(): string {
  const cfg = getConfig() as { contractsPath: string };
  const dir = resolvePathFromConfigDir(cfg.contractsPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    logger.verbose("created contracts directory", { dir });
  }
  return dir;
}

/**
 * Persist a base64 PDF to the contracts dir as `<sha256>.pdf` (content-addressed,
 * so identical re-uploads dedupe). Validates non-empty + size cap.
 */
export function saveContract(params: { dataBase64: string }): SavedContract {
  const buffer = Buffer.from(params.dataBase64, "base64");
  if (buffer.length === 0) {
    throw new Error("Contract is empty or contains invalid base64");
  }
  if (buffer.length > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error(
      `Contract exceeds maximum size of ${MAX_ATTACHMENT_SIZE_BYTES} bytes (got ${buffer.length})`
    );
  }
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const filename = `${sha256}.pdf`;
  const absolutePath = join(getContractsDir(), filename);
  writeFileSync(absolutePath, buffer);
  logger.verbose("contract saved", { filename, size: buffer.length });
  return { filename, size: buffer.length, sha256, absolutePath };
}

/**
 * Read a stored contract back as base64.
 */
export function readContract(filename: string): { dataBase64: string; size: number } {
  const absolutePath = join(getContractsDir(), filename);
  if (!existsSync(absolutePath)) {
    throw new Error(`Contract file not found on disk: ${filename}`);
  }
  const buffer = readFileSync(absolutePath);
  return { dataBase64: buffer.toString("base64"), size: buffer.length };
}
