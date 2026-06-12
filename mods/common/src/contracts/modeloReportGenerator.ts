/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Renders the "Modelo de negocio" projection as a branded PDF (pdfkit), using
 * the shared brand primitives (the `mikro` wordmark, palette, section heads, kv
 * rows) so it matches the Loan Application documents. Mirrors the on-screen
 * ModeloPage: summary stat cards, parameters, monthly projection, and
 * sensitivity scenarios. No AI — all values come from the projection engine.
 */
import PDFDocument from "pdfkit";
import type { FrecuenciaPago, ProjectionResult } from "../projection/engine.js";
import {
  MARGIN,
  CONTENT_W,
  BRAND_INK,
  TEXT,
  MUTED,
  LIGHT,
  PANEL,
  RULE,
  GREEN,
  AMBER,
  RED,
  type Fonts,
  type FontFaces,
  resolveFonts,
  needsPage,
  drawLogo,
  sectionHead,
  kvRow
} from "./pdfBrand.js";

/** Per-report input: the computed projection + render-time extras. */
export interface ModeloReportData {
  result: ProjectionResult;
  /** When the report was generated (rendered in es-DO). */
  generatedAt: Date;
  /** Inter font faces; falls back to Times when absent. */
  fonts?: FontFaces | null;
}

const FRECUENCIA_LABELS: Record<FrecuenciaPago, string> = {
  DIARIO: "Diario",
  SEMANAL: "Semanal",
  QUINCENAL: "Quincenal",
  MENSUAL: "Mensual"
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

function formatGeneratedAt(d: Date): string {
  const time = d.toLocaleTimeString("es-DO", { hour: "numeric", minute: "2-digit", hour12: true });
  return `Generado ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}, ${time}`;
}

const dop = (v: number) => `RD$ ${Math.round(v).toLocaleString("es-DO")}`;
const fmtK = (v: number) =>
  Math.abs(v) >= 1000 ? `RD$ ${Math.round(v / 1000)}K` : `RD$ ${Math.round(v)}`;
const pct = (v: number) => `${Math.round(v * 100)}%`;

export function renderModeloReportPdf(data: ModeloReportData): Promise<Buffer> {
  const { result } = data;
  const { config, summary, monthlySummaries, sensitivity } = result;

  const doc = new PDFDocument({
    size: "LETTER",
    bufferPages: true,
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: { Title: "Reporte del Modelo de Negocio", Author: "Mikro, S.R.L." }
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));

  const F = resolveFonts(doc, data.fonts);

  // ── Branded header ──────────────────────────────────────────────────────────
  const markH = drawLogo(doc, F, MARGIN, MARGIN);
  doc
    .fillColor(LIGHT)
    .font(F.med)
    .fontSize(9)
    .text(formatGeneratedAt(data.generatedAt), MARGIN, MARGIN + 6, {
      width: CONTENT_W,
      align: "right"
    });

  doc
    .fillColor(BRAND_INK)
    .font(F.bold)
    .fontSize(18)
    .text("Reporte del Modelo de Negocio", MARGIN, MARGIN + markH + 14, { width: CONTENT_W });
  doc
    .fillColor(MUTED)
    .font(F.reg)
    .fontSize(10.5)
    .text(
      `Proyección financiera y punto de equilibrio · horizonte de ${config.horizonteMeses} meses`,
      MARGIN,
      doc.y + 2,
      { width: CONTENT_W }
    );
  doc.moveDown(0.5);
  doc
    .save()
    .moveTo(MARGIN, doc.y)
    .lineTo(MARGIN + CONTENT_W, doc.y)
    .lineWidth(1)
    .strokeColor(RULE)
    .stroke()
    .restore();

  // ── Resumen: 2×2 stat cards ─────────────────────────────────────────────────
  sectionHead(doc, F, "Resumen");
  const be = summary.breakEvenWeek;
  const roiPositive = summary.roiAtHorizonPct >= 0;
  const cards: Array<{ label: string; value: string; delta: string; tone: string }> = [
    {
      label: "Punto de equilibrio",
      value: summary.breakEvenMonth !== null ? `Mes ${summary.breakEvenMonth}` : "—",
      delta: be !== null ? `Semana ${be} del horizonte` : "No se alcanza en el horizonte",
      tone: be !== null ? GREEN : RED
    },
    {
      label: "Ganancia mensual madura",
      value: fmtK(summary.matureMonthlyProfit),
      delta: "Promedio últimos 3 meses",
      tone: MUTED
    },
    {
      label: `ROI a ${config.horizonteMeses} meses`,
      value: `${summary.roiAtHorizonPct.toFixed(0)}%`,
      delta: `Sobre ${fmtK(summary.totalInvested)} invertidos`,
      tone: roiPositive ? GREEN : RED
    },
    {
      label: "Mínimo para cubrir gastos",
      value:
        summary.minLoansPerWeekForBreakeven >= 999
          ? "No viable"
          : `${summary.minLoansPerWeekForBreakeven} /sem`,
      delta: "Préstamos nuevos por semana",
      tone: MUTED
    }
  ];
  const cardW = (CONTENT_W - 14) / 2;
  const cardH = 58;
  const gap = 14;
  const cardsTop = doc.y;
  cards.forEach((c, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = MARGIN + col * (cardW + gap);
    const y = cardsTop + row * (cardH + gap);
    doc.save().roundedRect(x, y, cardW, cardH, 10).fill(PANEL).restore();
    doc
      .fillColor(LIGHT)
      .font(F.med)
      .fontSize(7.5)
      .text(c.label.toUpperCase(), x + 14, y + 11, { width: cardW - 28, characterSpacing: 0.5 });
    doc
      .fillColor(BRAND_INK)
      .font(F.bold)
      .fontSize(18)
      .text(c.value, x + 14, y + 22, { width: cardW - 28, lineBreak: false });
    doc
      .fillColor(c.tone)
      .font(F.med)
      .fontSize(8)
      .text(c.delta, x + 14, y + 44, { width: cardW - 28, lineBreak: false });
  });
  doc.y = cardsTop + 2 * cardH + gap + 4;

  // ── Parámetros ──────────────────────────────────────────────────────────────
  sectionHead(doc, F, "Parámetros");
  kvRow(
    doc,
    F,
    ["Inversión inicial", dop(config.inversionInicial)],
    ["Gastos fijos / mes", dop(config.gastosFijosMensuales)]
  );
  kvRow(
    doc,
    F,
    ["Inversión mensual", dop(config.inversionMensual)],
    ["Horizonte", `${config.horizonteMeses} meses`]
  );
  kvRow(
    doc,
    F,
    ["Monto promedio", dop(config.prestamoPromedio)],
    ["Tasa de interés", pct(config.tasaInteres)]
  );
  kvRow(
    doc,
    F,
    ["Frecuencia de pago", FRECUENCIA_LABELS[config.frecuenciaPago]],
    ["Plazo", `${config.plazoBase} cuotas`]
  );
  kvRow(
    doc,
    F,
    ["Préstamos nuevos / semana", String(config.prestamosPorSemana)],
    ["Morosidad esperada", pct(config.tasaMorosidad)]
  );
  kvRow(doc, F, ["Default esperado", pct(config.tasaDefault)]);

  // ── Proyección mensual ──────────────────────────────────────────────────────
  sectionHead(doc, F, "Proyección mensual");
  monthlyTable(doc, F, monthlySummaries);

  // ── Escenarios de sensibilidad ──────────────────────────────────────────────
  sectionHead(doc, F, "Escenarios de sensibilidad");
  sensitivity.forEach((s) => sensitivityCard(doc, F, s));

  doc.moveDown(0.6);
  doc
    .fillColor(LIGHT)
    .font(F.reg)
    .fontSize(8)
    .text(
      "Proyección estimada con base en los parámetros indicados. Los montos están en RD$. Mikro, S.R.L.",
      MARGIN,
      doc.y,
      { width: CONTENT_W }
    );

  doc.end();
  return done;
}

interface MonthCol {
  t: string;
  w: number;
  align: "left" | "right";
  get: (m: ProjectionResult["monthlySummaries"][number]) => string;
  signed?: boolean;
  signedVal?: (m: ProjectionResult["monthlySummaries"][number]) => number;
}

function monthlyTable(
  doc: PDFKit.PDFDocument,
  F: Fonts,
  months: ProjectionResult["monthlySummaries"]
) {
  const cols: MonthCol[] = [
    { t: "Mes", w: 32, align: "left", get: (m) => String(m.month) },
    { t: "Préstamos", w: 56, align: "left", get: (m) => String(m.newLoans) },
    { t: "Recaudo", w: 78, align: "right", get: (m) => dop(m.installmentCollections) },
    { t: "Mora", w: 60, align: "right", get: (m) => dop(m.moraIncome) },
    { t: "Gastos", w: 64, align: "right", get: (m) => dop(m.fixedCosts) },
    { t: "Pérdidas", w: 60, align: "right", get: (m) => dop(m.defaultLosses) },
    {
      t: "Neto",
      w: 72,
      align: "right",
      get: (m) => dop(m.netProfit),
      signed: true,
      signedVal: (m) => m.netProfit
    },
    {
      t: "Acumulado",
      w: 78,
      align: "right",
      get: (m) => dop(m.cumulativeProfit),
      signed: true,
      signedVal: (m) => m.cumulativeProfit
    }
  ];

  const drawHeader = () => {
    const hy = doc.y;
    doc
      .save()
      .rect(MARGIN, hy - 2, CONTENT_W, 18)
      .fill("#f8fafc")
      .restore();
    let hx = MARGIN;
    for (const c of cols) {
      doc
        .fillColor(MUTED)
        .font(F.semi)
        .fontSize(7)
        .text(c.t.toUpperCase(), hx + 4, hy + 3, {
          width: c.w - 6,
          characterSpacing: 0.5,
          align: c.align
        });
      hx += c.w;
    }
    doc.y = hy + 20;
  };

  drawHeader();
  months.forEach((m, i) => {
    if (doc.y + 16 > 792 - MARGIN) {
      doc.addPage();
      drawHeader();
    }
    const ry = doc.y;
    if (i % 2 === 1)
      doc
        .save()
        .rect(MARGIN, ry - 2, CONTENT_W, 16)
        .fill("#fbfcfe")
        .restore();
    let rx = MARGIN;
    for (const c of cols) {
      const color = c.signed ? (c.signedVal!(m) >= 0 ? GREEN : RED) : TEXT;
      const face = c.signed ? F.semi : F.reg;
      doc
        .fillColor(color)
        .font(face)
        .fontSize(8)
        .text(c.get(m), rx + 4, ry + 1, { width: c.w - 6, align: c.align, lineBreak: false });
      rx += c.w;
    }
    doc.y = ry + 16;
  });
}

/** A sensitivity scenario card — accent tick + label + composed sentence. */
function sensitivityCard(
  doc: PDFKit.PDFDocument,
  F: Fonts,
  s: ProjectionResult["sensitivity"][number]
) {
  // Same wording the ModeloPage SensitivityCard derives.
  const worse = s.minLoansNeeded !== undefined || s.description.includes("menos");
  const tone = s.minLoansNeeded !== undefined ? AMBER : worse ? RED : GREEN;

  let body: string;
  if (s.minLoansNeeded !== undefined) {
    body =
      s.minLoansNeeded >= 999
        ? `${s.description}: la operación no sería viable con la estructura actual.`
        : `${s.description}: necesitarías ${s.minLoansNeeded} préstamos nuevos por semana para cubrir los gastos fijos.`;
  } else {
    const beTxt =
      s.breakEvenMonth != null
        ? `el punto de equilibrio se mueve al mes ${s.breakEvenMonth}`
        : "no se alcanza el punto de equilibrio en el horizonte";
    body = `${s.description}: ${beTxt} y la ganancia madura queda en ${fmtK(s.matureMonthlyProfit ?? 0)}/mes.`;
  }

  needsPage(doc, 46);
  const topY = doc.y;
  const x = MARGIN + 12;
  const w = CONTENT_W - 12;
  doc
    .fillColor(tone)
    .font(F.semi)
    .fontSize(8)
    .text(s.label.toUpperCase(), x, topY, { width: w, characterSpacing: 0.6 });
  doc
    .fillColor(MUTED)
    .font(F.reg)
    .fontSize(9.5)
    .text(body, x, doc.y + 1.5, { width: w, lineGap: 1 });
  doc
    .save()
    .roundedRect(MARGIN, topY + 1, 3, doc.y - topY - 2, 1.5)
    .fill(tone)
    .restore();
  doc.moveDown(0.7);
}
