/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shared pdfkit brand primitives for Mikro's branded documents (solicitud
 * summary, modelo report). Geometry, palette, Inter-with-Times-fallback font
 * resolution, the `mikro` wordmark, section heads, and key/value rows — one
 * source so every document looks the same.
 */
// Letter page geometry.
export const PAGE_W = 612;
export const PAGE_H = 792;
export const MARGIN = 54;
export const CONTENT_W = PAGE_W - MARGIN * 2;
export const BOTTOM = PAGE_H - MARGIN;

// Brand palette — mirrors dashboard tokens in mods/dashboard/src/index.css.
export const BRAND_INK = "#14254a";
export const BRAND_DEEP = "#103a8a";
export const BRAND_PRIMARY = "#1f4aa8";
export const BRAND_SKY = "#3f86e0";
export const TEXT = "#1f2937";
export const MUTED = "#6b7280";
export const LIGHT = "#9aa3b2";
export const PANEL = "#f3f6fc";
export const TRACK = "#e6ebf4";
export const RULE = "#e2e7f0";

// Signal accents (match the detail-page score card).
export const GREEN = "#1f9d57";
export const AMBER = "#c2890b";
export const RED = "#c0392b";

/** Resolved font face names for the current document. */
export interface Fonts {
  reg: string;
  med: string;
  semi: string;
  bold: string;
}

/** Inter font faces (TTF bytes). When absent, the document falls back to Times. */
export interface FontFaces {
  regular: Buffer;
  medium: Buffer;
  semibold: Buffer;
  bold: Buffer;
}

/**
 * Register Inter (from supplied TTF bytes) on the document and return the face
 * names, or fall back to the built-in Times faces when no fonts are supplied.
 */
export function resolveFonts(doc: PDFKit.PDFDocument, fonts?: FontFaces | null): Fonts {
  if (fonts) {
    doc.registerFont("Inter", fonts.regular);
    doc.registerFont("Inter-Med", fonts.medium);
    doc.registerFont("Inter-Semi", fonts.semibold);
    doc.registerFont("Inter-Bold", fonts.bold);
    return { reg: "Inter", med: "Inter-Med", semi: "Inter-Semi", bold: "Inter-Bold" };
  }
  return { reg: "Times-Roman", med: "Times-Roman", semi: "Times-Bold", bold: "Times-Bold" };
}

/** Add a page if `height` pt won't fit before the bottom margin. */
export function needsPage(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > BOTTOM) doc.addPage();
}

/**
 * Draw the Mikro wordmark as vector at (x, y), in brand-deep Inter Bold.
 * Returns the drawn height. The favicon "m" mark is intentionally omitted —
 * glyph centering inside the rounded square never sits right in pdfkit.
 */
export function drawLogo(doc: PDFKit.PDFDocument, F: Fonts, x: number, y: number): number {
  const size = 28;
  doc.font(F.bold).fontSize(size);
  doc.fillColor(BRAND_DEEP).text("mikro", x, y, { lineBreak: false, characterSpacing: -0.3 });
  return doc.currentLineHeight();
}

/** Section heading — a brand-primary accent tick + uppercase tracked label. */
export function sectionHead(doc: PDFKit.PDFDocument, F: Fonts, title: string) {
  needsPage(doc, 48);
  doc.moveDown(0.7);
  const y = doc.y;
  doc
    .save()
    .roundedRect(MARGIN, y + 0.5, 3, 10, 1.5)
    .fill(BRAND_PRIMARY)
    .restore();
  doc
    .fillColor(BRAND_PRIMARY)
    .font(F.semi)
    .fontSize(8.5)
    .text(title.toUpperCase(), MARGIN + 11, y, { width: CONTENT_W - 11, characterSpacing: 0.9 });
  doc.moveDown(0.55);
}

/** Small grey sub-heading inside a section (e.g. "DESGLOSE POR CATEGORÍA"). */
export function subHead(doc: PDFKit.PDFDocument, F: Fonts, title: string) {
  needsPage(doc, 24);
  doc.moveDown(0.5);
  doc
    .fillColor(MUTED)
    .font(F.semi)
    .fontSize(7.5)
    .text(title.toUpperCase(), MARGIN, doc.y, { characterSpacing: 0.9 });
  doc.moveDown(0.45);
}

/** Two-column key/value row. */
export function kvRow(
  doc: PDFKit.PDFDocument,
  F: Fonts,
  left: [string, string],
  right?: [string, string]
) {
  needsPage(doc, 26);
  const y = doc.y;
  const colW = CONTENT_W / 2 - 8;

  doc.fillColor(LIGHT).font(F.med).fontSize(7.5).text(left[0].toUpperCase(), MARGIN, y, {
    width: colW,
    characterSpacing: 0.4
  });
  doc
    .fillColor(TEXT)
    .font(F.reg)
    .fontSize(10.5)
    .text(left[1], MARGIN, y + 10, { width: colW });

  if (right) {
    const x2 = MARGIN + CONTENT_W / 2 + 8;
    doc.fillColor(LIGHT).font(F.med).fontSize(7.5).text(right[0].toUpperCase(), x2, y, {
      width: colW,
      characterSpacing: 0.4
    });
    doc
      .fillColor(TEXT)
      .font(F.reg)
      .fontSize(10.5)
      .text(right[1], x2, y + 10, { width: colW });
  }

  doc.y = y + 27;
}

/** Single full-width key/value row (value may wrap). */
export function kvFull(doc: PDFKit.PDFDocument, F: Fonts, label: string, value: string) {
  needsPage(doc, 26);
  const y = doc.y;
  doc.fillColor(LIGHT).font(F.med).fontSize(7.5).text(label.toUpperCase(), MARGIN, y, {
    width: CONTENT_W,
    characterSpacing: 0.4
  });
  doc
    .fillColor(TEXT)
    .font(F.reg)
    .fontSize(10.5)
    .text(value, MARGIN, y + 10, { width: CONTENT_W });
  doc.y = doc.y + 8;
}
