/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Renders performance report (metrics + narrative) to PNG using satori.
 */
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { loadFonts } from "../receipts/fonts.js";
import {
  createPerformanceReportLayout,
  REPORT_WIDTH,
  REPORT_HEIGHT
} from "./performanceReportLayout.js";
import type { PortfolioMetrics, ReportNarrative } from "./types.js";

/** Pixel-density multiplier: renders at 2x for crisp text on mobile / after WhatsApp compression. */
const RENDER_SCALE = 2;

/** WhatsApp rejects media uploads larger than 5 MB. */
const WHATSAPP_MAX_SIZE = 5 * 1024 * 1024;

/**
 * Renders the performance report to a PNG buffer.
 */
export async function renderPerformanceReportToPng(
  metrics: PortfolioMetrics,
  narrative: ReportNarrative,
  generatedAt: string = new Date().toISOString()
): Promise<Buffer> {
  const fonts = await loadFonts();
  const layout = createPerformanceReportLayout(metrics, narrative, generatedAt);

  const svg = await satori(layout as Parameters<typeof satori>[0], {
    width: REPORT_WIDTH,
    height: REPORT_HEIGHT,
    fonts: fonts as Parameters<typeof satori>[1]["fonts"]
  });

  const renderWidth = Math.round(REPORT_WIDTH * RENDER_SCALE);

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: renderWidth }
  });
  const pngBuffer = resvg.render().asPng();

  // First pass: high-quality PNG compression
  let compressed = await sharp(pngBuffer)
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true
    })
    .toBuffer();

  // If still over WhatsApp limit, use palette mode for aggressive compression
  if (compressed.length > WHATSAPP_MAX_SIZE) {
    compressed = await sharp(pngBuffer)
      .png({
        compressionLevel: 9,
        adaptiveFiltering: true,
        palette: true
      })
      .toBuffer();
  }

  // Last resort: render at 1x resolution to stay under the limit
  if (compressed.length > WHATSAPP_MAX_SIZE) {
    const fallbackResvg = new Resvg(svg, {
      fitTo: { mode: "width", value: REPORT_WIDTH }
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
