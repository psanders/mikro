/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import pngToIco from "png-to-ico";

const log = globalThis.console.log.bind(globalThis.console);

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");
const svg = readFileSync(join(publicDir, "favicon.svg"));

const sizes = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "android-chrome-192x192.png", size: 192 },
  { name: "android-chrome-512x512.png", size: 512 }
];

for (const { name, size } of sizes) {
  await sharp(svg).resize(size, size).png().toFile(join(publicDir, name));
  log(`Wrote ${name}`);
}

const ico = await pngToIco([
  join(publicDir, "favicon-16x16.png"),
  join(publicDir, "favicon-32x32.png")
]);
writeFileSync(join(publicDir, "favicon.ico"), ico);
log(`Wrote favicon.ico (${ico.length} bytes)`);
