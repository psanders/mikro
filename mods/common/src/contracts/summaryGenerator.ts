/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Renders a branded, printable solicitud summary PDF using pdfkit. Typography is
 * Inter (registered from TTF bytes passed in by the server); falls back to Times
 * if no fonts are supplied. Mirrors the Solicitud detail page: applicant,
 * business, credit, references, housing, the full Mikro Score (headline +
 * category breakdown + indicators + flags) and the suggested follow-up
 * questions. The Mikro Score always starts on its own page. When the caller
 * supplies them, it also carries what the Ops panel shows past the form: the
 * AI summary, the evidence (map link as a QR code, cédula and business photos
 * embedded), the activity timeline and the WhatsApp conversation.
 */
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import sharp from "sharp";
import { agentDisplayName } from "../utils/agentNames.js";
import {
  APPLICATION_STATUS_LABELS,
  BUSINESS_TYPE_LABELS,
  PROVINCE_LABELS
} from "../schemas/application.js";
import {
  PAGE_H,
  MARGIN,
  CONTENT_W,
  BRAND_INK,
  BRAND_DEEP,
  BRAND_PRIMARY,
  BRAND_SKY,
  TEXT,
  MUTED,
  LIGHT,
  PANEL,
  TRACK,
  RULE,
  GREEN,
  AMBER,
  RED,
  BOTTOM,
  type Fonts,
  resolveFonts,
  needsPage,
  drawLogo,
  sectionHead,
  subHead,
  kvRow,
  kvFull
} from "./pdfBrand.js";

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

/** One evidence item: an image to embed, or a file shown as a placeholder (PDF, missing). */
export interface SummaryDocument {
  label: string;
  /** Raw image bytes (any format sharp reads); null/absent draws a placeholder tile. */
  image?: Buffer | null;
  /** Placeholder text when there is no image (e.g. "PDF", "Pendiente"). */
  note?: string;
}

/** One entry of the application's activity (its business events). */
export interface SummaryActivity {
  summary: string;
  actorName: string;
  occurredAt: Date;
}

/** One stored WhatsApp turn, as the panel's conversation thread shows it. */
export interface SummaryTurn {
  role: "INBOUND" | "AGENT" | "SYSTEM";
  content: string;
  agentName: string | null;
  hasImage: boolean;
  createdAt: Date;
}

export interface SummaryHandoff {
  reason: string;
  openedAt: Date;
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
  // Past the form — what the Ops panel shows (all optional; omitted sections are skipped)
  aiSummary?: string | null;
  mapUrl?: string | null;
  documents?: SummaryDocument[] | null;
  activity?: SummaryActivity[] | null;
  conversation?: { turns: SummaryTurn[]; handoffs: SummaryHandoff[] } | null;
  // Inter font faces (TTF bytes). When absent, falls back to Times.
  fonts?: {
    regular: Buffer;
    medium: Buffer;
    semibold: Buffer;
    bold: Buffer;
  } | null;
}

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
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre"
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

/** A labelled score bar: name on the left, value on the right, filled track below. */
function scoreBar(doc: PDFKit.PDFDocument, F: Fonts, label: string, value: number) {
  needsPage(doc, 30);
  const y = doc.y;
  const v = clamp100(value);
  doc
    .fillColor(TEXT)
    .font(F.reg)
    .fontSize(9)
    .text(label, MARGIN, y, { width: CONTENT_W - 52 });
  doc
    .fillColor(BRAND_INK)
    .font(F.semi)
    .fontSize(9)
    .text(`${value}`, MARGIN + CONTENT_W - 52, y, { width: 28, align: "right" });
  doc
    .fillColor(LIGHT)
    .font(F.reg)
    .fontSize(8)
    .text("/100", MARGIN + CONTENT_W - 24, y + 0.5, { width: 24, align: "right" });
  const barY = y + 14;
  doc.save().roundedRect(MARGIN, barY, CONTENT_W, 5, 2.5).fill(TRACK).restore();
  doc
    .save()
    .roundedRect(MARGIN, barY, (v / 100) * CONTENT_W, 5, 2.5)
    .fill(BRAND_PRIMARY)
    .restore();
  doc.y = barY + 14;
}

/** A suggested follow-up question card (topic / question / reason). */
function noteBlock(doc: PDFKit.PDFDocument, F: Fonts, n: SummaryEvaluatorNote) {
  // Estimate height so the card doesn't split awkwardly across pages.
  needsPage(doc, 52);
  const x = MARGIN + 12;
  const w = CONTENT_W - 12;
  const topY = doc.y;

  doc
    .fillColor(BRAND_SKY)
    .font(F.semi)
    .fontSize(7.5)
    .text(n.topic.toUpperCase(), x, topY, { width: w, characterSpacing: 0.6 });
  doc
    .fillColor(BRAND_INK)
    .font(F.reg)
    .fontSize(10.5)
    .text(n.question, x, doc.y + 1.5, { width: w });
  if (n.reason?.trim()) {
    doc
      .fillColor(MUTED)
      .font(F.reg)
      .fontSize(9)
      .text(n.reason, x, doc.y + 1.5, { width: w, lineGap: 1 });
  }
  // Accent bar spanning the card height.
  doc
    .save()
    .roundedRect(MARGIN, topY + 1, 3, doc.y - topY - 2, 1.5)
    .fill(BRAND_SKY)
    .restore();
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
  doc
    .fillColor(MUTED)
    .font(F.med)
    .fontSize(15)
    .text("/ 100", MARGIN + 24 + numW + 8, numY + 22);
  // Risk band under the number
  if (data.riskBand) {
    doc
      .fillColor(bandColor(data.riskBand))
      .font(F.semi)
      .fontSize(11)
      .text(RISK_LABELS[data.riskBand] ?? data.riskBand, MARGIN + 24, numY + 50);
  }

  // Right column: recommendation + confidence
  const rx = MARGIN + CONTENT_W / 2 + 16;
  const rw = CONTENT_W / 2 - 40;
  doc
    .fillColor(LIGHT)
    .font(F.med)
    .fontSize(7.5)
    .text("RECOMENDACIÓN", rx, panelY + 18, { characterSpacing: 0.5 });
  doc
    .fillColor(BRAND_INK)
    .font(F.semi)
    .fontSize(11.5)
    .text(
      data.recommendation
        ? (RECOMMENDATION_LABELS[data.recommendation] ?? data.recommendation)
        : "—",
      rx,
      panelY + 29,
      { width: rw }
    );
  doc
    .fillColor(LIGHT)
    .font(F.med)
    .fontSize(7.5)
    .text("CONFIANZA", rx, panelY + 54, { characterSpacing: 0.5 });
  doc
    .fillColor(BRAND_INK)
    .font(F.semi)
    .fontSize(11.5)
    .text(
      data.confidence ? (CONFIDENCE_LABELS[data.confidence] ?? data.confidence) : "—",
      rx,
      panelY + 65,
      { width: rw }
    );

  doc.y = panelY + panelH + 18;

  // Full-width progress bar
  const barY = doc.y;
  const fill =
    data.riskBand === "LOW_RISK" ? GREEN : bandColor(data.riskBand) === RED ? RED : BRAND_PRIMARY;
  doc.save().roundedRect(MARGIN, barY, CONTENT_W, 6, 3).fill(TRACK).restore();
  doc
    .save()
    .roundedRect(MARGIN, barY, (clamp100(score) / 100) * CONTENT_W, 6, 3)
    .fill(fill)
    .restore();
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
      doc
        .fillColor(RED)
        .font(F.semi)
        .fontSize(9.5)
        .text(`•  ${f.message}`, MARGIN, doc.y, { width: CONTENT_W });
      doc.moveDown(0.25);
    }
  }
}

const DR_TZ = "America/Santo_Domingo";

/** "29/9/26, 3:04 p. m." in Dominican time. */
function formatDateTime(d: Date): string {
  return d.toLocaleString("es-DO", { timeZone: DR_TZ, dateStyle: "short", timeStyle: "short" });
}

/** Inter has no emoji glyphs; pdfkit would draw tofu boxes. */
function pdfText(s: string): string {
  return s
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

/** Downscaled, EXIF-rotated JPEG pdfkit can embed; null when the bytes aren't an image. */
async function toPdfImage(bytes: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(bytes)
      .rotate()
      .resize({ width: 1000, height: 1000, fit: "inside", withoutEnlargement: true })
      .flatten({ background: "#ffffff" })
      .jpeg({ quality: 72 })
      .toBuffer();
  } catch {
    return null;
  }
}

interface PreparedDocument {
  label: string;
  image: Buffer | null;
  note: string;
}

/** Short AI summary panel under the header. */
function renderAiSummary(doc: PDFKit.PDFDocument, F: Fonts, text: string) {
  const pad = 12;
  const w = CONTENT_W - pad * 2;
  doc.font(F.reg).fontSize(9.5);
  const h = doc.heightOfString(text, { width: w, lineGap: 1.5 }) + 16 + pad * 2;
  needsPage(doc, h);
  doc.moveDown(0.6);
  const y = doc.y;
  doc.save().roundedRect(MARGIN, y, CONTENT_W, h, 8).fill(PANEL).restore();
  doc
    .fillColor(BRAND_PRIMARY)
    .font(F.semi)
    .fontSize(7.5)
    .text("RESUMEN", MARGIN + pad, y + pad, { width: w, characterSpacing: 0.6 });
  doc
    .fillColor(TEXT)
    .font(F.reg)
    .fontSize(9.5)
    .text(text, MARGIN + pad, doc.y + 3, { width: w, lineGap: 1.5 });
  doc.y = y + h;
}

/** Evidencia: map QR + photo/document grid. Starts on its own page. */
function renderEvidence(
  doc: PDFKit.PDFDocument,
  F: Fonts,
  mapUrl: string | null,
  qr: Buffer | null,
  documents: PreparedDocument[]
) {
  doc.addPage();
  doc.fillColor(BRAND_INK).font(F.bold).fontSize(17).text("Evidencia", MARGIN, doc.y);

  sectionHead(doc, F, "Ubicación del negocio");
  if (mapUrl && qr) {
    const size = 104;
    const y = doc.y;
    doc.image(qr, MARGIN, y, { width: size, height: size });
    const tx = MARGIN + size + 18;
    const tw = CONTENT_W - size - 18;
    doc
      .fillColor(BRAND_INK)
      .font(F.semi)
      .fontSize(10.5)
      .text("Escanea para abrir el mapa", tx, y + 20, { width: tw });
    doc
      .fillColor(BRAND_PRIMARY)
      .font(F.reg)
      .fontSize(8.5)
      .text(mapUrl, tx, doc.y + 4, { width: tw, link: mapUrl, underline: true });
    doc.y = y + size + 4;
  } else {
    doc
      .fillColor(MUTED)
      .font(F.reg)
      .fontSize(9.5)
      .text("Sin ubicación registrada.", MARGIN, doc.y, { width: CONTENT_W });
  }

  sectionHead(doc, F, "Fotos y documentos");
  const gap = 16;
  const cellW = (CONTENT_W - gap) / 2;
  const imgH = Math.round(cellW * 0.75);
  const rowH = imgH + 24;
  for (let i = 0; i < documents.length; i += 2) {
    needsPage(doc, rowH);
    const y = doc.y;
    documents.slice(i, i + 2).forEach((d, j) => {
      const x = MARGIN + j * (cellW + gap);
      doc.save().roundedRect(x, y, cellW, imgH, 6).fill(PANEL).restore();
      if (d.image) {
        doc.image(d.image, x, y, { fit: [cellW, imgH], align: "center", valign: "center" });
      } else {
        doc
          .fillColor(LIGHT)
          .font(F.med)
          .fontSize(9)
          .text(d.note, x, y + imgH / 2 - 6, { width: cellW, align: "center" });
      }
      doc
        .fillColor(TEXT)
        .font(F.med)
        .fontSize(8.5)
        .text(d.label, x, y + imgH + 6, { width: cellW, lineBreak: false, ellipsis: true });
    });
    doc.y = y + rowH;
  }
}

/** Actividad: the application's events, oldest first. */
function renderActivity(doc: PDFKit.PDFDocument, F: Fonts, activity: SummaryActivity[]) {
  sectionHead(doc, F, "Actividad");
  const tx = MARGIN + 16;
  const tw = CONTENT_W - 16;
  activity.forEach((e, i) => {
    doc.font(F.semi).fontSize(9.5);
    const h = doc.heightOfString(e.summary, { width: tw }) + 16;
    needsPage(doc, h);
    const y = doc.y;
    doc
      .save()
      .circle(MARGIN + 4, y + 5, 3)
      .fill(BRAND_PRIMARY)
      .restore();
    if (i < activity.length - 1) {
      doc
        .save()
        .strokeColor(RULE)
        .lineWidth(1)
        .moveTo(MARGIN + 4, y + 11)
        .lineTo(MARGIN + 4, y + h + 2)
        .stroke()
        .restore();
    }
    doc.fillColor(BRAND_INK).text(e.summary, tx, y, { width: tw });
    doc
      .fillColor(MUTED)
      .font(F.reg)
      .fontSize(8)
      .text(`${e.actorName}  ·  ${formatDateTime(e.occurredAt)}`, tx, doc.y + 1, { width: tw });
    doc.y = y + h + 4;
  });
}

const BUBBLE_IN = "#ffffff";
const BUBBLE_OUT = "#dcf3e4";

/** Conversación: WhatsApp turns as chat bubbles, hand-offs as centered markers. */
function renderConversation(
  doc: PDFKit.PDFDocument,
  F: Fonts,
  personName: string,
  turns: SummaryTurn[],
  handoffs: SummaryHandoff[]
) {
  doc.addPage();
  doc.fillColor(BRAND_INK).font(F.bold).fontSize(17).text("Conversación · WhatsApp", MARGIN, doc.y);
  doc.moveDown(0.6);

  type Item =
    | { kind: "turn"; at: number; turn: SummaryTurn }
    | { kind: "handoff"; at: number; handoff: SummaryHandoff };
  const items: Item[] = [
    ...handoffs.map((h) => ({ kind: "handoff" as const, at: h.openedAt.getTime(), handoff: h })),
    ...turns
      .filter((t) => t.content.trim() || t.hasImage)
      .map((t) => ({ kind: "turn" as const, at: t.createdAt.getTime(), turn: t }))
  ].sort((a, b) => a.at - b.at || (a.kind === b.kind ? 0 : a.kind === "turn" ? 1 : -1));

  const pad = 8;
  const bw = Math.round(CONTENT_W * 0.72);
  const tw = bw - pad * 2;
  for (const item of items) {
    if (item.kind === "handoff") {
      needsPage(doc, 22);
      doc
        .fillColor(AMBER)
        .font(F.semi)
        .fontSize(8)
        .text(
          `Pasó a una persona  ·  ${item.handoff.reason}  ·  ${formatDateTime(item.handoff.openedAt)}`,
          MARGIN,
          doc.y + 2,
          { width: CONTENT_W, align: "center" }
        );
      doc.moveDown(0.8);
      continue;
    }
    const t = item.turn;
    const inbound = t.role === "INBOUND";
    const who = inbound
      ? personName
      : t.role === "AGENT"
        ? agentDisplayName(t.agentName)
        : "Mikro (automático)";
    const photo = t.hasImage ? "[Foto]" : "";
    const content = t.hasImage && t.content === "[Imagen]" ? "" : pdfText(t.content);
    const body = [photo, content].filter(Boolean).join("\n");

    doc.font(F.reg).fontSize(9.5);
    const bodyH = body ? doc.heightOfString(body, { width: tw, lineGap: 1 }) : 0;
    const h = pad + 11 + (body ? bodyH + 3 : 0) + 12 + pad;
    // A message taller than a page can't sit in one box: draw it unboxed and
    // let the text flow onto the next page.
    const fits = h <= BOTTOM - MARGIN;
    needsPage(doc, fits ? h : 60);
    const x = inbound ? MARGIN : MARGIN + CONTENT_W - bw;
    const y = doc.y;
    if (fits) {
      doc
        .save()
        .roundedRect(x, y, bw, h, 8)
        .fillAndStroke(inbound ? BUBBLE_IN : BUBBLE_OUT, inbound ? RULE : BUBBLE_OUT)
        .restore();
    }
    doc
      .fillColor(t.role === "AGENT" ? BRAND_PRIMARY : MUTED)
      .font(F.semi)
      .fontSize(8)
      .text(who, x + pad, y + pad, { width: tw });
    if (body) {
      doc
        .fillColor(BRAND_INK)
        .font(F.reg)
        .fontSize(9.5)
        .text(body, x + pad, doc.y + 3, { width: tw, lineGap: 1 });
    }
    doc
      .fillColor(LIGHT)
      .font(F.reg)
      .fontSize(7.5)
      .text(formatDateTime(t.createdAt), x + pad, doc.y + 3, { width: tw });
    doc.y = (fits ? Math.max(doc.y + pad, y + h) : doc.y + pad) + 6;
  }
}

export async function renderSummaryPdf(data: SolicitudSummaryData): Promise<Buffer> {
  // Async prep first (image re-encode, QR); drawing below is synchronous.
  const mapUrl = data.mapUrl?.trim() || null;
  const qr = mapUrl
    ? await QRCode.toBuffer(mapUrl, { errorCorrectionLevel: "M", margin: 1, width: 400 })
    : null;
  const documents: PreparedDocument[] = await Promise.all(
    (data.documents ?? []).map(async (d) => ({
      label: d.label,
      image: d.image ? await toPdfImage(d.image) : null,
      note: d.note ?? (d.image ? "No se pudo mostrar la imagen" : "Sin archivo")
    }))
  );

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
  const F = resolveFonts(doc, data.fonts);

  const name = [data.firstName, data.lastName].filter(Boolean).join(" ").trim() || "—";
  const statusLabel =
    APPLICATION_STATUS_LABELS[data.status as keyof typeof APPLICATION_STATUS_LABELS] ?? data.status;
  const businessTypeLabel = data.businessType
    ? (BUSINESS_TYPE_LABELS[data.businessType] ?? data.businessType)
    : "—";
  const provinceLabel = data.province ? (PROVINCE_LABELS[data.province] ?? data.province) : "—";

  // ── Branded header ──────────────────────────────────────────────────────────
  const markH = drawLogo(doc, F, MARGIN, MARGIN);

  doc
    .fillColor(BRAND_INK)
    .font(F.bold)
    .fontSize(18)
    .text("Solicitud de préstamo", MARGIN, MARGIN + markH + 14, { width: CONTENT_W });
  doc
    .fillColor(MUTED)
    .font(F.reg)
    .fontSize(9.5)
    .text(
      `#${data.id.slice(0, 8).toUpperCase()}    ·    ${formatDate(data.createdAt)}    ·    ${statusLabel}`,
      MARGIN,
      doc.y + 3,
      { width: CONTENT_W }
    );

  doc.moveDown(0.5);
  doc
    .save()
    .strokeColor(BRAND_DEEP)
    .lineWidth(2)
    .moveTo(MARGIN, doc.y)
    .lineTo(MARGIN + CONTENT_W, doc.y)
    .stroke()
    .restore();
  doc.moveDown(0.3);

  if (data.aiSummary?.trim()) {
    renderAiSummary(doc, F, pdfText(data.aiSummary));
  }

  // ── Solicitante ──────────────────────────────────────────────────────────────
  sectionHead(doc, F, "Solicitante");
  kvRow(doc, F, ["Nombre completo", name], ["Teléfono", val(data.phone)]);
  kvRow(
    doc,
    F,
    ["Cédula", val(data.idNumber)],
    ["Fecha de nacimiento", formatDate(data.dateOfBirth)]
  );
  kvRow(doc, F, ["Estado civil", val(data.maritalStatus)], undefined);

  // ── Negocio ──────────────────────────────────────────────────────────────────
  sectionHead(doc, F, "Negocio");
  kvRow(
    doc,
    F,
    ["Tipo de negocio", businessTypeLabel],
    ["Nombre del negocio", val(data.businessName)]
  );
  kvRow(
    doc,
    F,
    ["Tiempo operando", val(data.businessAge)],
    ["Ventas mensuales", val(data.monthlySales)]
  );
  kvRow(doc, F, ["Local", val(data.locationType)], ["Formalización", val(data.formalization)]);
  kvRow(
    doc,
    F,
    ["Nº de empleados", val(data.employeeCount)],
    ["Teléfono del negocio", val(data.businessPhone)]
  );

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
  const spouseDisplay = data.spouseName
    ? `${data.spouseName}${data.spousePhone ? ` · ${data.spousePhone}` : ""}`
    : "—";
  const refDisplay = data.referenceName
    ? `${data.referenceName}${data.referencePhone ? ` · ${data.referencePhone}` : ""}`
    : "—";
  kvRow(doc, F, ["Cónyuge", spouseDisplay], undefined);
  kvRow(doc, F, ["Referencia personal", refDisplay], undefined);

  // ── Vivienda ────────────────────────────────────────────────────────────────
  sectionHead(doc, F, "Vivienda");
  kvRow(
    doc,
    F,
    ["Tipo de vivienda", val(data.housingType)],
    ["Tiempo residiendo", val(data.residenceTime)]
  );
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

  // ── Evidencia, Actividad, Conversación (the panel's sections) ──────────────────
  if (documents.length > 0 || mapUrl) {
    renderEvidence(doc, F, mapUrl, qr, documents);
  }
  if (data.activity && data.activity.length > 0) {
    renderActivity(doc, F, data.activity);
  }
  if (data.conversation && data.conversation.turns.length > 0) {
    renderConversation(
      doc,
      F,
      data.firstName?.trim() || "Solicitante",
      data.conversation.turns,
      data.conversation.handoffs
    );
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
    doc
      .save()
      .strokeColor(RULE)
      .lineWidth(0.5)
      .moveTo(MARGIN, fy - 9)
      .lineTo(MARGIN + CONTENT_W, fy - 9)
      .stroke()
      .restore();
    doc
      .fillColor(LIGHT)
      .font(F.reg)
      .fontSize(7.5)
      .text("Mikro S.R.L.  ·  RNC 1-33-61735-8  ·  Para uso interno únicamente.", MARGIN, fy, {
        width: CONTENT_W - 60,
        align: "left",
        lineBreak: false
      });
    doc
      .fillColor(LIGHT)
      .font(F.reg)
      .fontSize(7.5)
      .text(`${i + 1} / ${range.count}`, MARGIN + CONTENT_W - 60, fy, {
        width: 60,
        align: "right",
        lineBreak: false
      });
  }

  doc.end();
  return done;
}
