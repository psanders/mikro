/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { logger } from "../logger.js";

/**
 * Save a receipt image to disk.
 *
 * @param loanNumber - The loan number to use as filename (e.g., "10000")
 * @param imageBase64 - Base64-encoded PNG image
 * @param imagesPath - Path to the images directory
 * @returns The filename that was saved (e.g., "10000.png")
 */
export function saveReceiptImage(
  loanNumber: string,
  imageBase64: string,
  imagesPath: string
): string {
  // Ensure images directory exists
  if (!existsSync(imagesPath)) {
    mkdirSync(imagesPath, { recursive: true });
    logger.verbose("created images directory", { imagesPath });
  }

  // Create filename using loan number
  const filename = `${loanNumber}.png`;
  const filePath = join(imagesPath, filename);

  // Convert base64 to buffer and write to disk
  const imageBuffer = Buffer.from(imageBase64, "base64");
  writeFileSync(filePath, imageBuffer);

  logger.verbose("receipt image saved", { filename, filePath, size: imageBuffer.length });
  return filename;
}
