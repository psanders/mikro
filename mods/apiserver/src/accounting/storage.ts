/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { createHash } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { extname, join } from "path";
import {
  getConfig,
  resolvePathFromConfigDir,
  MAX_ATTACHMENT_SIZE_BYTES,
  allowedAttachmentMimeTypes
} from "@mikro/common";
import { logger } from "../logger.js";

const MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "application/pdf": ".pdf"
};

export interface SavedAttachment {
  filename: string;
  size: number;
  sha256: string;
  absolutePath: string;
}

/**
 * Returns the absolute base directory for accounting attachments, creating it
 * on demand so callers never race on a missing directory.
 */
export function getAccountingAttachmentsDir(): string {
  const cfg = getConfig();
  const dir = resolvePathFromConfigDir(cfg.accounting.attachmentsPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    logger.verbose("created accounting attachments directory", { dir });
  }
  return dir;
}

/**
 * Persists a base64-encoded attachment to disk. Validates mime type and size.
 * File name is `<transactionId>-<sha256[:12]>.<ext>`.
 */
export function saveTransactionAttachment(params: {
  transactionId: string;
  mimeType: string;
  dataBase64: string;
}): SavedAttachment {
  if (!(allowedAttachmentMimeTypes as readonly string[]).includes(params.mimeType)) {
    throw new Error(`Unsupported attachment mimeType: ${params.mimeType}`);
  }

  const buffer = Buffer.from(params.dataBase64, "base64");
  if (buffer.length === 0) {
    throw new Error("Attachment is empty or contains invalid base64");
  }
  if (buffer.length > MAX_ATTACHMENT_SIZE_BYTES) {
    throw new Error(
      `Attachment exceeds maximum size of ${MAX_ATTACHMENT_SIZE_BYTES} bytes (got ${buffer.length})`
    );
  }

  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const ext = MIME_TO_EXT[params.mimeType] ?? "";
  const filename = `${params.transactionId}-${sha256.slice(0, 12)}${ext}`;
  const dir = getAccountingAttachmentsDir();
  const absolutePath = join(dir, filename);

  writeFileSync(absolutePath, buffer);
  logger.verbose("accounting attachment saved", {
    transactionId: params.transactionId,
    filename,
    size: buffer.length
  });

  return { filename, size: buffer.length, sha256, absolutePath };
}

/**
 * Reads a stored attachment back from disk and returns its base64-encoded content.
 */
export function readTransactionAttachment(filename: string): {
  dataBase64: string;
  size: number;
  extension: string;
} {
  const dir = getAccountingAttachmentsDir();
  const absolutePath = join(dir, filename);
  if (!existsSync(absolutePath)) {
    throw new Error(`Attachment file not found on disk: ${filename}`);
  }
  const buffer = readFileSync(absolutePath);
  return {
    dataBase64: buffer.toString("base64"),
    size: buffer.length,
    extension: extname(filename)
  };
}
