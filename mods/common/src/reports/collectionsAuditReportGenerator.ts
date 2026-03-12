/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Renders the daily collections audit report to PNG using Satori.
 */
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { loadFonts } from "../receipts/fonts.js";
import {
  createCollectionsAuditReportLayout,
  getCollectionsAuditReportHeight,
  COLLECTIONS_AUDIT_REPORT_WIDTH,
  type CollectionsAuditRow
} from "./collectionsAuditReportLayout.js";

const RENDER_SCALE = 2;
const WHATSAPP_MAX_SIZE = 5 * 1024 * 1024;

/**
 * Renders the collections audit report to a PNG buffer.
 */
export async function renderCollectionsAuditReportToPng(
  rows: CollectionsAuditRow[],
  auditDateLabel: string,
  generatedAt: string = new Date().toLocaleString("es-DO", {
    dateStyle: "medium",
    timeStyle: "short"
  }),
  logoDataUrl?: string
): Promise<Buffer> {
  const height = getCollectionsAuditReportHeight(rows);
  const fonts = await loadFonts();
  const layout = createCollectionsAuditReportLayout(rows, auditDateLabel, generatedAt, logoDataUrl);

  const svg = await satori(layout as Parameters<typeof satori>[0], {
    width: COLLECTIONS_AUDIT_REPORT_WIDTH,
    height,
    fonts: fonts as Parameters<typeof satori>[1]["fonts"]
  });

  const renderWidth = Math.round(COLLECTIONS_AUDIT_REPORT_WIDTH * RENDER_SCALE);
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
      fitTo: { mode: "width", value: COLLECTIONS_AUDIT_REPORT_WIDTH }
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
