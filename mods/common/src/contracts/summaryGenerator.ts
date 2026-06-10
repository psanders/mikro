/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Renders a branded, printable solicitud summary PDF using pdfkit. Typography is
 * Inter (registered from TTF bytes passed in by the server); falls back to Times
 * if no fonts are supplied. Mirrors the Solicitud detail page: applicant,
 * business, credit, references, housing, the full Mikro Score (headline +
 * category breakdown + indicators + flags) and the suggested follow-up
 * questions. The Mikro Score always starts on its own page.
 */
import PDFDocument from "pdfkit";
import { BUSINESS_TYPE_LABELS, PROVINCE_LABELS } from "../schemas/application.js";

export interface SummaryScoreCategory {
  category: string;
  weight: number;
  score: number;
}

export interface SummaryScoreIndicators {
  amount_requested: { value: number | null; unit: string };
  term_weeks: { value: number | null; unit: string };
  monthly_installment: { value: number | null; unit: string };
  monthly_sales: { value: number | null; unit: string };
  net_income: { value: number | null; unit: string };
  debt_service_ratio: { value: number | null; unit: string };
}

export interface SummaryEvaluatorNote {
  topic: string;
  question: string;
  reason: string;
}

export interface SolicitudSummaryData {
  id: string;
  createdAt: Date;
  status: string;
  // Solicitante
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  idNumber: string | null;
  dateOfBirth: Date | null;
  maritalStatus: string | null;
  // Negocio
  businessType: string | null;
  businessName: string | null;
  businessAge: string | null;
  monthlySales: string | null;
  locationType: string | null;
  formalization: string | null;
  employeeCount: string | null;
  businessPhone: string | null;
  // Crédito
  requestedAmount: number | null;
  purpose: string | null;
  requestedTermWeeks: number | null;
  // Referencias
  spouseName: string | null;
  spousePhone: string | null;
  referenceName: string | null;
  referencePhone: string | null;
  // Vivienda
  housingType: string | null;
  residenceTime: string | null;
  homeAddress: string | null;
  province: string | null;
  addressReference: string | null;
  // Score (headline)
  score: number | null;
  riskBand: string | null;
  recommendation: string | null;
  confidence: string | null;
  // Score (detail) — category breakdown, indicators, follow-up questions, flags
  scoreCategories?: SummaryScoreCategory[] | null;
  scoreIndicators?: SummaryScoreIndicators | null;
  evaluatorNotes?: SummaryEvaluatorNote[] | null;
  flags?: Array<{ code: string; message: string }> | null;
  // Inter font faces (TTF bytes). When absent, falls back to Times.
  fonts?: {
    regular: Buffer;
    medium: Buffer;
    semibold: Buffer;
    bold: Buffer;
  } | null;
}

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BOTTOM = PAGE_H - MARGIN;

// Brand palette — mirrors dashboard tokens in mods/dashboard/src/index.css.
const BRAND_INK = "#14254a";
const BRAND_DEEP = "#103a8a";
const BRAND_PRIMARY = "#1f4aa8";
const BRAND_SKY = "#3f86e0";
const TEXT = "#1f2937";
const MUTED = "#6b7280";
const LIGHT = "#9aa3b2";
const PANEL = "#f3f6fc";
const TRACK = "#e6ebf4";
const RULE = "#e2e7f0";

// Risk-band accent colors (match the detail-page score card signal).
const GREEN = "#1f9d57";
const AMBER = "#c2890b";
const RED = "#c0392b";

/** Resolved font face names for the current document. */
interface Fonts {
  reg: string;
  med: string;
  semi: string;
  bold: string;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  RECEIVED: "Nueva",
  IN_REVIEW: "En evaluación",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  SIGNED: "Firmada",
  CONVERTED: "Convertida"
};

const RISK_LABELS: Record<string, string> = {
  LOW_RISK: "Riesgo bajo",
  MODERATE_RISK: "Riesgo moderado",
  MEDIUM_HIGH_RISK: "Riesgo medio-alto",
  HIGH_RISK: "Riesgo alto",
  VERY_HIGH_RISK: "Riesgo muy alto",
  OUT_OF_COVERAGE: "Fuera de zona"
};

const RECOMMENDATION_LABELS: Record<string, string> = {
  APPROVE: "Aprobar",
  APPROVE_WITH_CONDITIONS: "Aprobar con condiciones",
  MANUAL_REVIEW: "Revisión manual",
  LIKELY_REJECT: "Probable rechazo",
  REJECT: "Rechazar",
  REJECT_OUT_OF_ZONE: "Rechazar — fuera de zona",
  REJECT_CRITICAL_BUSINESS: "Rechazar — negocio no elegible"
};

const CONFIDENCE_LABELS: Record<string, string> = {
  HIGH: "Alta",
  MEDIUM: "Media",
  LOW: "Baja"
};

const CATEGORY_LABELS: Record<string, string> = {
  PAYMENT_CAPACITY: "Capacidad de pago",
  BUSINESS_TYPE_RISK: "Riesgo del negocio",
  TRACK_RECORD_FORMALIZATION: "Trayectoria y formalización",
  ROOTEDNESS_STABILITY: "Arraigo y estabilidad",
  SUPPORT_NETWORK: "Red de soporte",
  LOAN_PURPOSE: "Propósito del préstamo"
};

const INDICATOR_LABELS: Record<keyof SummaryScoreIndicators, string> = {
  amount_requested: "Monto solicitado",
  term_weeks: "Plazo",
  monthly_installment: "Cuota mensual",
  monthly_sales: "Ventas mensuales",
  net_income: "Ingreso neto",
  debt_service_ratio: "Ratio de servicio de deuda"
};

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"
];

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return `${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
}

function formatDop(v: number | null): string {
  if (v == null) return "—";
  return `RD$ ${v.toLocaleString("es-DO", { maximumFractionDigits: 0 })}`;
}

function val(v: string | null | undefined): string {
  return v?.trim() || "—";
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, n));
}

function bandColor(band: string | null): string {
  if (band === "LOW_RISK") return GREEN;
  if (band === "HIGH_RISK" || band === "VERY_HIGH_RISK" || band === "OUT_OF_COVERAGE") return RED;
  if (band === "MODERATE_RISK" || band === "MEDIUM_HIGH_RISK") return AMBER;
  return MUTED;
}

function formatIndicator(ind: { value: number | null; unit: string } | undefined): string {
  if (!ind || ind.value == null) return "—";
  const u = ind.unit?.toUpperCase();
  if (u === "DOP" || u === "RD$") return formatDop(ind.value);
  if (u === "%" || u === "PERCENT") return `${ind.value}%`;
  if (u === "WEEKS" || u === "SEMANAS") return `${ind.value} semanas`;
  return `${ind.value}${ind.unit ? ` ${ind.unit}` : ""}`;
}

/** Add a page if `height` pt won't fit before the bottom margin. */
function needsPage(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > BOTTOM) doc.addPage();
}

/**
 * Draw the Mikro wordmark as vector at (x, y), in brand-deep Inter Bold.
 * Returns the drawn height. The favicon "m" mark is intentionally omitted —
 * glyph centering inside the rounded square never sits right in pdfkit.
 */
function drawLogo(doc: PDFKit.PDFDocument, F: Fonts, x: number, y: number): number {
  const size = 28;
  doc.font(F.bold).fontSize(size);
  doc.fillColor(BRAND_DEEP).text("mikro", x, y, { lineBreak: false, characterSpacing: -0.3 });
  return doc.currentLineHeight();
}

/** Section heading — a brand-primary accent tick + uppercase tracked label. */
function sectionHead(doc: PDFKit.PDFDocument, F: Fonts, title: string) {
  needsPage(doc, 48);
  doc.moveDown(0.7);
  const y = doc.y;
  doc.save().roundedRect(MARGIN, y + 0.5, 3, 10, 1.5).fill(BRAND_PRIMARY).restore();
  doc.fillColor(BRAND_PRIMARY).font(F.semi).fontSize(8.5)
    .text(title.toUpperCase(), MARGIN + 11, y, { width: CONTENT_W - 11, characterSpacing: 0.9 });
  doc.moveDown(0.55);
}

/** Small grey sub-heading inside a section (e.g. "DESGLOSE POR CATEGORÍA"). */
function subHead(doc: PDFKit.PDFDocument, F: Fonts, title: string) {
  needsPage(doc, 24);
  doc.moveDown(0.5);
  doc.fillColor(MUTED).font(F.semi).fontSize(7.5)
    .text(title.toUpperCase(), MARGIN, doc.y, { characterSpacing: 0.9 });
  doc.moveDown(0.45);
}

/** Two-column key/value row. */
function kvRow(
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
  doc.fillColor(TEXT).font(F.reg).fontSize(10.5).text(left[1], MARGIN, y + 10, { width: colW });

  if (right) {
    const x2 = MARGIN + CONTENT_W / 2 + 8;
    doc.fillColor(LIGHT).font(F.med).fontSize(7.5).text(right[0].toUpperCase(), x2, y, {
      width: colW,
      characterSpacing: 0.4
    });
    doc.fillColor(TEXT).font(F.reg).fontSize(10.5).text(right[1], x2, y + 10, { width: colW });
  }

  doc.y = y + 27;
}

/** Single full-width key/value row (value may wrap). */
function kvFull(doc: PDFKit.PDFDocument, F: Fonts, label: string, value: string) {
  needsPage(doc, 26);
  const y = doc.y;
  doc.fillColor(LIGHT).font(F.med).fontSize(7.5).text(label.toUpperCase(), MARGIN, y, {
    width: CONTENT_W,
    characterSpacing: 0.4
  });
  doc.fillColor(TEXT).font(F.reg).fontSize(10.5).text(value, MARGIN, y + 10, { width: CONTENT_W });
  doc.y = doc.y + 8;
}

/** A labelled score bar: name on the left, value on the right, filled track below. */
function scoreBar(doc: PDFKit.PDFDocument, F: Fonts, label: string, value: number) {
  needsPage(doc, 30);
  const y = doc.y;
  const v = clamp100(value);
  doc.fillColor(TEXT).font(F.reg).fontSize(9).text(label, MARGIN, y, { width: CONTENT_W - 52 });
  doc.fillColor(BRAND_INK).font(F.semi).fontSize(9)
    .text(`${value}`, MARGIN + CONTENT_W - 52, y, { width: 28, align: "right" });
  doc.fillColor(LIGHT).font(F.reg).fontSize(8)
    .text("/100", MARGIN + CONTENT_W - 24, y + 0.5, { width: 24, align: "right" });
  const barY = y + 14;
  doc.save().roundedRect(MARGIN, barY, CONTENT_W, 5, 2.5).fill(TRACK).restore();
  doc.save().roundedRect(MARGIN, barY, (v / 100) * CONTENT_W, 5, 2.5).fill(BRAND_PRIMARY).restore();
  doc.y = barY + 14;
}

/** A suggested follow-up question card (topic / question / reason). */
function noteBlock(doc: PDFKit.PDFDocument, F: Fonts, n: SummaryEvaluatorNote) {
  // Estimate height so the card doesn't split awkwardly across pages.
  needsPage(doc, 52);
  const x = MARGIN + 12;
  const w = CONTENT_W - 12;
  const topY = doc.y;

  doc.fillColor(BRAND_SKY).font(F.semi).fontSize(7.5)
    .text(n.topic.toUpperCase(), x, topY, { width: w, characterSpacing: 0.6 });
  doc.fillColor(BRAND_INK).font(F.reg).fontSize(10.5)
    .text(n.question, x, doc.y + 1.5, { width: w });
  if (n.reason?.trim()) {
    doc.fillColor(MUTED).font(F.reg).fontSize(9)
      .text(n.reason, x, doc.y + 1.5, { width: w, lineGap: 1 });
  }
  // Accent bar spanning the card height.
  doc.save().roundedRect(MARGIN, topY + 1, 3, doc.y - topY - 2, 1.5).fill(BRAND_SKY).restore();
  doc.moveDown(0.85);
}

/** The Mikro Score page: headline panel, category bars, indicators, flags. */
function renderScorePage(doc: PDFKit.PDFDocument, F: Fonts, data: SolicitudSummaryData) {
  doc.addPage();

  // Page title
  doc.fillColor(BRAND_INK).font(F.bold).fontSize(17).text("Mikro Score", MARGIN, doc.y);
  doc.moveDown(0.5);

  // ── Headline panel ────────────────────────────────────────────────────────
  const panelY = doc.y;
  const panelH = 86;
  doc.save().roundedRect(MARGIN, panelY, CONTENT_W, panelH, 12).fill(PANEL).restore();

  const score = data.score ?? 0;
  // Big number + "/ 100"
  doc.font(F.bold).fontSize(44);
  const numW = doc.widthOfString(String(score));
  const numY = panelY + 16;
  doc.fillColor(BRAND_INK).text(String(score), MARGIN + 24, numY);
  doc.fillColor(MUTED).font(F.med).fontSize(15).text("/ 100", MARGIN + 24 + numW + 8, numY + 22);
  // Risk band under the number
  if (data.riskBand) {
    doc.fillColor(bandColor(data.riskBand)).font(F.semi).fontSize(11)
      .text(RISK_LABELS[data.riskBand] ?? data.riskBand, MARGIN + 24, numY + 50);
  }

  // Right column: recommendation + confidence
  const rx = MARGIN + CONTENT_W / 2 + 16;
  const rw = CONTENT_W / 2 - 40;
  doc.fillColor(LIGHT).font(F.med).fontSize(7.5)
    .text("RECOMENDACIÓN", rx, panelY + 18, { characterSpacing: 0.5 });
  doc.fillColor(BRAND_INK).font(F.semi).fontSize(11.5).text(
    data.recommendation ? (RECOMMENDATION_LABELS[data.recommendation] ?? data.recommendation) : "—",
    rx,
    panelY + 29,
    { width: rw }
  );
  doc.fillColor(LIGHT).font(F.med).fontSize(7.5)
    .text("CONFIANZA", rx, panelY + 54, { characterSpacing: 0.5 });
  doc.fillColor(BRAND_INK).font(F.semi).fontSize(11.5).text(
    data.confidence ? (CONFIDENCE_LABELS[data.confidence] ?? data.confidence) : "—",
    rx,
    panelY + 65,
    { width: rw }
  );

  doc.y = panelY + panelH + 18;

  // Full-width progress bar
  const barY = doc.y;
  const fill = data.riskBand === "LOW_RISK" ? GREEN : bandColor(data.riskBand) === RED ? RED : BRAND_PRIMARY;
  doc.save().roundedRect(MARGIN, barY, CONTENT_W, 6, 3).fill(TRACK).restore();
  doc.save().roundedRect(MARGIN, barY, (clamp100(score) / 100) * CONTENT_W, 6, 3).fill(fill).restore();
  doc.y = barY + 20;

  // ── Category breakdown ────────────────────────────────────────────────────
  if (data.scoreCategories && data.scoreCategories.length > 0) {
    subHead(doc, F, "Desglose por categoría");
    for (const c of data.scoreCategories) {
      scoreBar(doc, F, `${CATEGORY_LABELS[c.category] ?? c.category}  ·  ${c.weight}%`, c.score);
    }
  }

  // ── Indicators ────────────────────────────────────────────────────────────
  if (data.scoreIndicators) {
    subHead(doc, F, "Indicadores");
    const ind = data.scoreIndicators;
    kvRow(
      doc,
      F,
      [INDICATOR_LABELS.amount_requested, formatIndicator(ind.amount_requested)],
      [INDICATOR_LABELS.monthly_sales, formatIndicator(ind.monthly_sales)]
    );
    kvRow(
      doc,
      F,
      [INDICATOR_LABELS.monthly_installment, formatIndicator(ind.monthly_installment)],
      [INDICATOR_LABELS.net_income, formatIndicator(ind.net_income)]
    );
    kvRow(
      doc,
      F,
      [INDICATOR_LABELS.term_weeks, formatIndicator(ind.term_weeks)],
      [INDICATOR_LABELS.debt_service_ratio, formatIndicator(ind.debt_service_ratio)]
    );
  }

  // ── Flags ─────────────────────────────────────────────────────────────────
  if (data.flags && data.flags.length > 0) {
    subHead(doc, F, "Alertas");
    for (const f of data.flags) {
      needsPage(doc, 16);
      doc.fillColor(RED).font(F.semi).fontSize(9.5)
        .text(`•  ${f.message}`, MARGIN, doc.y, { width: CONTENT_W });
      doc.moveDown(0.25);
    }
  }
}

export function renderSummaryPdf(data: SolicitudSummaryData): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "LETTER",
    bufferPages: true,
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: {
      Title: `Solicitud ${data.id.slice(0, 8).toUpperCase()}`,
      Author: "Mikro, S.R.L."
    }
  });

  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));

  // Register Inter (or fall back to the built-in Times faces).
  let F: Fonts;
  if (data.fonts) {
    doc.registerFont("Inter", data.fonts.regular);
    doc.registerFont("Inter-Med", data.fonts.medium);
    doc.registerFont("Inter-Semi", data.fonts.semibold);
    doc.registerFont("Inter-Bold", data.fonts.bold);
    F = { reg: "Inter", med: "Inter-Med", semi: "Inter-Semi", bold: "Inter-Bold" };
  } else {
    F = { reg: "Times-Roman", med: "Times-Roman", semi: "Times-Bold", bold: "Times-Bold" };
  }

  const name = [data.firstName, data.lastName].filter(Boolean).join(" ").trim() || "—";
  const statusLabel = STATUS_LABELS[data.status] ?? data.status;
  const businessTypeLabel = data.businessType
    ? (BUSINESS_TYPE_LABELS[data.businessType] ?? data.businessType)
    : "—";
  const provinceLabel = data.province ? (PROVINCE_LABELS[data.province] ?? data.province) : "—";

  // ── Branded header ──────────────────────────────────────────────────────────
  const markH = drawLogo(doc, F, MARGIN, MARGIN);

  doc.fillColor(BRAND_INK).font(F.bold).fontSize(18)
    .text("Solicitud de préstamo", MARGIN, MARGIN + markH + 14, { width: CONTENT_W });
  doc.fillColor(MUTED).font(F.reg).fontSize(9.5).text(
    `#${data.id.slice(0, 8).toUpperCase()}    ·    ${formatDate(data.createdAt)}    ·    ${statusLabel}`,
    MARGIN,
    doc.y + 3,
    { width: CONTENT_W }
  );

  doc.moveDown(0.5);
  doc.save().strokeColor(BRAND_DEEP).lineWidth(2)
    .moveTo(MARGIN, doc.y).lineTo(MARGIN + CONTENT_W, doc.y).stroke().restore();
  doc.moveDown(0.3);

  // ── Solicitante ──────────────────────────────────────────────────────────────
  sectionHead(doc, F, "Solicitante");
  kvRow(doc, F, ["Nombre completo", name], ["Teléfono", val(data.phone)]);
  kvRow(doc, F, ["Cédula", val(data.idNumber)], ["Fecha de nacimiento", formatDate(data.dateOfBirth)]);
  kvRow(doc, F, ["Estado civil", val(data.maritalStatus)], undefined);

  // ── Negocio ──────────────────────────────────────────────────────────────────
  sectionHead(doc, F, "Negocio");
  kvRow(doc, F, ["Tipo de negocio", businessTypeLabel], ["Nombre del negocio", val(data.businessName)]);
  kvRow(doc, F, ["Tiempo operando", val(data.businessAge)], ["Ventas mensuales", val(data.monthlySales)]);
  kvRow(doc, F, ["Local", val(data.locationType)], ["Formalización", val(data.formalization)]);
  kvRow(doc, F, ["Nº de empleados", val(data.employeeCount)], ["Teléfono del negocio", val(data.businessPhone)]);

  // ── Crédito ───────────────────────────────────────────────────────────────────
  sectionHead(doc, F, "Crédito solicitado");
  kvRow(
    doc,
    F,
    ["Monto solicitado", formatDop(data.requestedAmount)],
    ["Plazo", data.requestedTermWeeks ? `${data.requestedTermWeeks} semanas` : "—"]
  );
  kvFull(doc, F, "Propósito", val(data.purpose));

  // ── Referencias ───────────────────────────────────────────────────────────────
  sectionHead(doc, F, "Referencias");
  const spouseDisplay =
    data.spouseName ? `${data.spouseName}${data.spousePhone ? ` · ${data.spousePhone}` : ""}` : "—";
  const refDisplay =
    data.referenceName
      ? `${data.referenceName}${data.referencePhone ? ` · ${data.referencePhone}` : ""}`
      : "—";
  kvRow(doc, F, ["Cónyuge", spouseDisplay], undefined);
  kvRow(doc, F, ["Referencia personal", refDisplay], undefined);

  // ── Vivienda ────────────────────────────────────────────────────────────────
  sectionHead(doc, F, "Vivienda");
  kvRow(doc, F, ["Tipo de vivienda", val(data.housingType)], ["Tiempo residiendo", val(data.residenceTime)]);
  kvRow(doc, F, ["Provincia", provinceLabel], ["Dirección", val(data.homeAddress)]);
  if (data.addressReference) {
    kvFull(doc, F, "Referencia de dirección", data.addressReference);
  }

  // ── Mikro Score (own page) ────────────────────────────────────────────────────
  if (data.score != null) {
    renderScorePage(doc, F, data);
  }

  // ── Preguntas sugeridas ────────────────────────────────────────────────────────
  if (data.evaluatorNotes && data.evaluatorNotes.length > 0) {
    sectionHead(doc, F, "Preguntas sugeridas");
    doc.moveDown(0.1);
    for (const n of data.evaluatorNotes) noteBlock(doc, F, n);
  }

  // ── Footer on every page ──────────────────────────────────────────────────────
  // Stamp after layout. The footer sits below the bottom margin, so zero the
  // page's bottom margin while drawing — otherwise pdfkit treats the positioned
  // text as overflow and appends a blank page for each stamp.
  const range = doc.bufferedPageRange();
  const fy = PAGE_H - MARGIN + 18;
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.page.margins.bottom = 0;
    doc.save().strokeColor(RULE).lineWidth(0.5)
      .moveTo(MARGIN, fy - 9).lineTo(MARGIN + CONTENT_W, fy - 9).stroke().restore();
    doc.fillColor(LIGHT).font(F.reg).fontSize(7.5).text(
      "Mikro S.R.L.  ·  RNC 1-33-61735-8  ·  Para uso interno únicamente.",
      MARGIN,
      fy,
      { width: CONTENT_W - 60, align: "left", lineBreak: false }
    );
    doc.fillColor(LIGHT).font(F.reg).fontSize(7.5).text(
      `${i + 1} / ${range.count}`,
      MARGIN + CONTENT_W - 60,
      fy,
      { width: 60, align: "right", lineBreak: false }
    );
  }

  doc.end();
  return done;
}
