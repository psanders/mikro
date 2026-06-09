/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
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
 * Best-effort unlink of a stored contract file. Used when an application is
 * purged so we don't leave orphaned PDFs on disk. Missing files are ignored.
 */
export function deleteContract(filename: string): void {
  const absolutePath = join(getContractsDir(), filename);
  if (existsSync(absolutePath)) {
    unlinkSync(absolutePath);
    logger.verbose("contract deleted", { filename });
  }
}

export interface SavedImage {
  filename: string;
  size: number;
  sha256: string;
  absolutePath: string;
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

/**
 * Persist a base64 image to the contracts dir as `<sha256>.<ext>` (content-
 * addressed). Used for static cédula front/back uploads. Validates non-empty +
 * size cap and a supported image mime type.
 */
export function saveImage(params: { dataBase64: string; mimeType: string }): SavedImage {
  const ext = IMAGE_EXTENSIONS[params.mimeType];
  if (!ext) throw new Error(`Unsupported image type: ${params.mimeType}`);
  const buffer = Buffer.from(params.dataBase64, "base64");
  if (buffer.length === 0) throw new Error("Image is empty or contains invalid base64");
  if (buffer.length > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error(
      `Image exceeds maximum size of ${MAX_ATTACHMENT_SIZE_BYTES} bytes (got ${buffer.length})`
    );
  }
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const filename = `${sha256}.${ext}`;
  const absolutePath = join(getContractsDir(), filename);
  writeFileSync(absolutePath, buffer);
  logger.verbose("id image saved", { filename, size: buffer.length });
  return { filename, size: buffer.length, sha256, absolutePath };
}

/**
 * Read a stored image back as base64.
 */
export function readImage(filename: string): { dataBase64: string; size: number } {
  const absolutePath = join(getContractsDir(), filename);
  if (!existsSync(absolutePath)) {
    throw new Error(`Image file not found on disk: ${filename}`);
  }
  const buffer = readFileSync(absolutePath);
  return { dataBase64: buffer.toString("base64"), size: buffer.length };
}

/**
 * Best-effort unlink of a stored image file (used on purge). Missing files OK.
 */
export function deleteImage(filename: string): void {
  const absolutePath = join(getContractsDir(), filename);
  if (existsSync(absolutePath)) {
    unlinkSync(absolutePath);
    logger.verbose("id image deleted", { filename });
  }
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
