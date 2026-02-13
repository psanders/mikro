/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Test images for agent evaluations.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get the directory of this file to resolve relative paths
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const assetsDir = path.resolve(__dirname, "../../assets");

/**
 * Detect media type from file content magic bytes.
 * Falls back to extension-based detection.
 */
function detectMediaType(buffer: Buffer, filename: string): string {
  // Check magic bytes: JPEG starts with FF D8 FF, PNG starts with 89 50 4E 47
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  // Fallback to extension
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "image/png";
}

function loadImageAsBase64(filename: string): string {
  const filePath = path.join(assetsDir, filename);
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString("base64");
  const mediaType = detectMediaType(buffer, filename);
  return `data:${mediaType};base64,${base64}`;
}

// Export test images (lower resolution to avoid OpenAI rate limits)
export const testCedulaFront = loadImageAsBase64("cedula-front.png");
export const testCedulaBack = loadImageAsBase64("cedula-back.png");

// Expected data from the test cédula
// Note: The vision model may extract names in different orders (first+last vs last+first)
// The cédula shows: PEDRO SANTIAGO (first) SANDERS ALMONTE (last)
export const testCedulaData = {
  name: "Pedro Santiago Sanders Almonte",
  cedula: "037-0089330-2"
};
