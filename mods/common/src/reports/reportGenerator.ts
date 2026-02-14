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

  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: REPORT_WIDTH }
  });
  const pngBuffer = resvg.render().asPng();

  const compressed = await sharp(pngBuffer)
    .png({
      compressionLevel: 9,
      adaptiveFiltering: true
    })
    .toBuffer();

  return compressed;
}
