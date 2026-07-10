/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Multi-page branded PDF renderer. Reuses the exact receipts pipeline — satori
 * layout → `@resvg/resvg-js` SVG raster → `sharp` PNG — to render each page,
 * then places the full-page PNGs into a multi-page PDF via `pdfkit`. This
 * guarantees pixel-fidelity with the receipts brand look and reuses the Inter
 * font-loading path verbatim (no separate font embedding).
 *
 * Trade-off (per design): pages are raster images, so PDF text is not
 * selectable. Acceptable for a branded statement; the JSON payload carries all
 * data for programmatic use.
 */
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import sharp from "sharp";
import PDFDocument from "pdfkit";
import { loadFonts, type Font } from "../receipts/fonts.js";
import { PAGE_WIDTH, PAGE_HEIGHT, type ReportElement } from "./blocks.js";

/** One page to render: a satori element tree at the given dimensions. */
export interface ReportPage {
  layout: ReportElement;
  width?: number;
  height?: number;
}

/** A multi-page report document ready for rendering. */
export interface ReportDocument {
  pages: ReportPage[];
}

/**
 * Renderer dependencies. Fonts are injectable so tests (and offline callers)
 * can supply their own font bytes instead of the network `loadFonts` fetch —
 * DI, no live service. Defaults to the receipts Inter font pipeline.
 */
export interface RenderReportDeps {
  loadFonts?: () => Promise<Font[]>;
}

/** Supersampling factor for the raster pages (matches the receipts 2x). */
const SCALE = 2;

/** Render a single page's element tree to a PNG Buffer via satori → Resvg → sharp. */
async function renderPageToPng(
  page: ReportPage,
  fonts: Font[]
): Promise<{ png: Buffer; width: number; height: number }> {
  const width = page.width ?? PAGE_WIDTH;
  const height = page.height ?? PAGE_HEIGHT;

  const svg = await satori(page.layout as Parameters<typeof satori>[0], {
    width,
    height,
    fonts: fonts as Parameters<typeof satori>[1]["fonts"]
  });

  const resvg = new Resvg(svg, { fitTo: { mode: "width", value: width * SCALE } });
  const pngBuffer = resvg.render().asPng();

  const compressed = await sharp(pngBuffer)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();

  return { png: compressed, width, height };
}

/**
 * Render a {@link ReportDocument} to a valid multi-page PDF Buffer. Each page is
 * rasterized through the receipts pipeline and placed full-bleed into its own
 * PDF page sized to the layout.
 *
 * @param doc - the document to render (must have at least one page)
 * @returns a PDF Buffer (starts with the `%PDF` header)
 */
export async function renderReportToPdf(
  doc: ReportDocument,
  deps: RenderReportDeps = {}
): Promise<Buffer> {
  if (!doc.pages || doc.pages.length === 0) {
    throw new Error("renderReportToPdf: document has no pages");
  }

  const fonts = await (deps.loadFonts ?? loadFonts)();
  const rendered = await Promise.all(doc.pages.map((p) => renderPageToPng(p, fonts)));

  const pdf = new PDFDocument({ autoFirstPage: false });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    pdf.on("data", (c: Buffer) => chunks.push(c));
    pdf.on("end", () => resolve(Buffer.concat(chunks)));
    pdf.on("error", reject);
  });

  for (const r of rendered) {
    pdf.addPage({ size: [r.width, r.height], margin: 0 });
    pdf.image(r.png, 0, 0, { width: r.width, height: r.height });
  }
  pdf.end();

  return done;
}
