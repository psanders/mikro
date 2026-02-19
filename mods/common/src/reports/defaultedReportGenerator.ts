/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Renders defaulted loans report to PNG using Satori.
 */
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { loadFonts } from "../receipts/fonts.js";
import {
  createDefaultedReportLayout,
  getDefaultedReportHeight,
  DEFAULTED_REPORT_WIDTH,
  type DefaultedReportRow
} from "./defaultedReportLayout.js";

/** Pixel-density multiplier for crisp text on mobile. */
const RENDER_SCALE = 2;

/** WhatsApp rejects media uploads larger than 5 MB. */
const WHATSAPP_MAX_SIZE = 5 * 1024 * 1024;

/**
 * Renders the defaulted report to a PNG buffer.
 */
export async function renderDefaultedReportToPng(
  rows: DefaultedReportRow[],
  totalPrincipal: number,
  generatedAt: string = new Date().toISOString(),
  logoDataUrl?: string
): Promise<Buffer> {
  const height = getDefaultedReportHeight(rows);

  const fonts = await loadFonts();
  const layout = createDefaultedReportLayout(rows, totalPrincipal, generatedAt, logoDataUrl);

  const svg = await satori(layout as Parameters<typeof satori>[0], {
    width: DEFAULTED_REPORT_WIDTH,
    height,
    fonts: fonts as Parameters<typeof satori>[1]["fonts"]
  });

  const renderWidth = Math.round(DEFAULTED_REPORT_WIDTH * RENDER_SCALE);

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: renderWidth }
  });
  const pngBuffer = resvg.render().asPng();

  let compressed = await sharp(pngBuffer)
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true
    })
    .toBuffer();

  if (compressed.length > WHATSAPP_MAX_SIZE) {
    compressed = await sharp(pngBuffer)
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: true
      })
      .toBuffer();
  }

  if (compressed.length > WHATSAPP_MAX_SIZE) {
    const fallbackResvg = new Resvg(svg, {
      fitTo: { mode: "width", value: DEFAULTED_REPORT_WIDTH }
    });
    const fallbackPng = fallbackResvg.render().asPng();
    compressed = await sharp(fallbackPng)
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: true
      })
      .toBuffer();
  }

  return compressed;
}
