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

function loadImageAsBase64(filename: string): string {
  const filePath = path.join(assetsDir, filename);
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString("base64");
  return `data:image/png;base64,${base64}`;
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
