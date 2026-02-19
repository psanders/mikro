/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Renders customers report (grouped by payment health) to PNG using Satori.
 */
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import { loadFonts } from "../receipts/fonts.js";
import { buildGroupedCustomerRows } from "../utils/customerReportGrouping.js";
import type { CustomerForGrouping } from "../utils/customerReportGrouping.js";
import {
  createCustomersReportLayout,
  getCustomersReportHeight,
  CUSTOMERS_REPORT_WIDTH
} from "./customersReportLayout.js";

/** Pixel-density multiplier for crisp text on mobile. */
const RENDER_SCALE = 2;

/** WhatsApp rejects media uploads larger than 5 MB. */
const WHATSAPP_MAX_SIZE = 5 * 1024 * 1024;

/**
 * Renders the customers report to a PNG buffer.
 * Groups customers by payment health (Crítico / Requiere atención / Al día).
 */
export async function renderCustomersReportToPng(
  customers: CustomerForGrouping[],
  generatedAt: string = new Date().toISOString(),
  logoDataUrl?: string
): Promise<Buffer> {
  const grouped = buildGroupedCustomerRows(customers);
  const customerCount = customers.length;
  const loanCount = grouped.critico.length + grouped.requiereAtencion.length + grouped.alDia.length;

  const height = getCustomersReportHeight(grouped);

  const fonts = await loadFonts();
  const layout = createCustomersReportLayout(
    grouped,
    customerCount,
    loanCount,
    generatedAt,
    logoDataUrl
  );

  const svg = await satori(layout as Parameters<typeof satori>[0], {
    width: CUSTOMERS_REPORT_WIDTH,
    height,
    fonts: fonts as Parameters<typeof satori>[1]["fonts"]
  });

  const renderWidth = Math.round(CUSTOMERS_REPORT_WIDTH * RENDER_SCALE);

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
      fitTo: { mode: "width", value: CUSTOMERS_REPORT_WIDTH }
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
