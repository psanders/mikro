/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Renders the Mikro loan contract to a PDF (pdfkit), matching the reference
 * `contrato-prestamo` skill: a plain Dominican notarial loan contract — Times,
 * 1-inch margins, centered title, justified clauses, a side-by-side signature
 * table, and the notary block. No brand chrome.
 *
 * Note: this pdfkit build does not render Helvetica glyphs, so all text is Times.
 */
import PDFDocument from "pdfkit";
import { FREQUENCY_PLURAL } from "./constants.js";
import { getContractConfig } from "../config.js";
import { numberToWords, pesosInWords } from "./numberToWords.js";
import type { ContractData } from "./types.js";

const MONTHS = [
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
const INCH = 72;
const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = INCH;
const CONTENT_W = PAGE_W - MARGIN * 2;
const BLACK = "#000000";

/** Move to a fresh page if `height` pt won't fit — pdfkit has no keep-together. */
function keepBlock(doc: PDFKit.PDFDocument, height: number) {
  if (doc.y + height > PAGE_H - MARGIN) doc.addPage();
}

function fecha(d: Date): string {
  return `${d.getDate()} de ${MONTHS[d.getMonth()]} del año ${d.getFullYear()}`;
}
function endDate(start: Date, freq: ContractData["frequency"], n: number): Date {
  const d = new Date(start);
  const s = Math.max(0, n - 1);
  if (freq === "DAILY") d.setDate(d.getDate() + s);
  else if (freq === "WEEKLY") d.setDate(d.getDate() + s * 7);
  else if (freq === "BIWEEKLY") d.setDate(d.getDate() + s * 14);
  else d.setMonth(d.getMonth() + s);
  return d;
}

export function renderContractPdf(data: ContractData): Promise<Buffer> {
  // Names are stored in proper case in config; the contract renders them upper-
  // case (same convention as the debtor name). Legal-entity names are left as-is.
  const cfg = getContractConfig();
  const up = (s: string) => s.toUpperCase();
  const K = {
    ...cfg,
    creditor: {
      ...cfg.creditor,
      representative: { ...cfg.creditor.representative, name: up(cfg.creditor.representative.name) }
    },
    payment: { ...cfg.payment, accountHolder: up(cfg.payment.accountHolder) },
    notary: { ...cfg.notary, name: up(cfg.notary.name) }
  };
  const doc = new PDFDocument({
    size: "LETTER",
    margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
    info: { Title: "Contrato de Préstamo de Dinero", Author: "Mikro, S.R.L." }
  });
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const done = new Promise<Buffer>((res) => doc.on("end", () => res(Buffer.concat(chunks))));

  const end = endDate(data.startDate, data.frequency, data.installments);
  const rep = K.creditor.representative;
  const deudorNombre = data.debtor.name.toUpperCase();

  // Título
  doc.fillColor(BLACK).font("Times-Bold").fontSize(14).text("CONTRATO DE PRÉSTAMO DE DINERO", {
    align: "center"
  });
  doc.moveDown(1);

  // Comparecientes
  body(
    doc,
    `ENTRE: De una parte, ${K.creditor.legalName}, sociedad comercial constituida y organizada de conformidad ` +
      `con las leyes de la República Dominicana, con Registro Nacional de Contribuyentes (RNC) No. ` +
      `${K.creditor.rnc}, con su domicilio social en la ${K.creditor.address}, debidamente representada por su ` +
      `Gerente, el señor ${rep.name}, dominicano, mayor de edad, titular de la cédula de identidad y electoral ` +
      `No. ${rep.cedula}, domiciliado y residente en esta ciudad de ${rep.city}, República Dominicana, quien en ` +
      `lo adelante y para los fines del presente contrato se denominará EL ACREEDOR; Y de la otra parte, ` +
      `${deudorNombre}, de nacionalidad dominicana, mayor de edad, ` +
      joinParts([data.debtor.maritalStatus, data.debtor.occupation]) +
      `titular de la cédula de identidad No. ${data.debtor.cedula}, con domicilio y residencia en ` +
      `${data.debtor.city}, quien en lo adelante y para los fines del presente contrato se denominará EL DEUDOR.`
  );
  doc.moveDown(0.6);

  // Encabezado del cuerpo
  doc
    .font("Times-Bold")
    .fontSize(11)
    .text("SE HA CONVENIDO Y PACTADO LO SIGUIENTE", { align: "center" });
  doc.moveDown(0.6);

  clause(
    doc,
    "PRIMERO:",
    `Por medio del presente contrato EL ACREEDOR, da en calidad de préstamo de dinero a EL DEUDOR, la suma de ` +
      `${pesosInWords(data.principal)}, monto que es entregado en efectivo a la firma del presente.`
  );
  clause(
    doc,
    "SEGUNDO:",
    `Por lo que EL DEUDOR, se compromete a pagar ${numberToWords(data.installments).toUpperCase()} ` +
      `(${data.installments}) CUOTAS ${FREQUENCY_PLURAL[data.frequency]}, CON UN VALOR DE ` +
      `${pesosInWords(data.installmentAmount)} a partir del día ${fecha(data.startDate)} y culminar el día ` +
      `${fecha(end)}.`
  );
  clause(
    doc,
    "TERCERO:",
    `Las cuotas serán pagadas mediante transferencias o depósitos que deben realizarse en la ` +
      `${K.payment.accountType} número ${K.payment.accountNumber} de la ${K.payment.bank}, cuenta que figura a ` +
      `nombre de la señora ${K.payment.accountHolder}, titular de la cédula de identidad No. ` +
      `${K.payment.accountHolderCedula}. También podrán pagarse entregando en efectivo en las manos de EL ` +
      `ACREEDOR, o en las manos de un representante de EL ACREEDOR debidamente autorizado que presente ` +
      `identificación válida al momento del pago.`
  );
  clause(
    doc,
    "CUARTO:",
    `EL DEUDOR está obligado a pagar el monto establecido en este contrato en el tiempo estipulado. En caso de ` +
      `retraso en el pago de una cuota, EL DEUDOR pagará por concepto de mora una penalidad equivalente al ` +
      `${numberToWords(K.mora.ratePct)} por ciento (${K.mora.ratePct}%) del valor de la cuota correspondiente por ` +
      `cada ${numberToWords(K.mora.periodDays)} (${K.mora.periodDays}) días de atraso, calculada de forma ` +
      `proporcional por cada día de retraso. Esta mora se acumulará junto al monto adeudado hasta que la cuota ` +
      `sea saldada en su totalidad.`
  );
  clause(
    doc,
    "QUINTO:",
    `De no ser cumplida la obligación establecida en este contrato para EL DEUDOR, este mismo contrato servirá ` +
      `como prueba firme para llevar a cabo todo tipo de acción judicial a favor de EL ACREEDOR.`
  );

  // Cierre
  doc.moveDown(0.6);
  body(
    doc,
    `REDACTADO Y FIRMADO DE BUENA FE, en dos originales de un mismo tenor y efecto, uno para cada parte, en la ` +
      `ciudad de ${K.city}, República Dominicana, a los ${fecha(data.contractDate)}.`
  );

  // Firmas (side-by-side) — keep the whole block on one page.
  doc.moveDown(1.5);
  keepBlock(doc, 74);
  signatureTable(doc, deudorNombre, rep.name);

  // Bloque notarial — keep the paragraph + signature together.
  const nt = K.notary;
  doc.moveDown(2.4);
  keepBlock(doc, 170);
  body(
    doc,
    `Yo, ${nt.name}, Abogado, Notario Público de los del Número para el Municipio de ${nt.municipality}, ` +
      `inscrito en el Colegio de Notarios con el número ${nt.collegeNumber} y RNC No. ${nt.rnc}, con estudio ` +
      `profesional abierto en la ${nt.office}, CERTIFICO Y DOY FE: Que las firmas que aparecen en la página ` +
      `anterior fueron puestas libre y voluntariamente por los arriba firmantes señores, ${rep.name}, en ` +
      `representación de ${K.creditor.legalName}, y ${deudorNombre}, asegurándome que son las firmas que ` +
      `acostumbran a realizar en todos los actos de su vida pública o privada. En la ciudad de San Felipe de ` +
      `${nt.municipality}, Municipio y provincia de ${nt.municipality}, República Dominicana, a los ` +
      `${fecha(data.contractDate)}. –`
  );
  doc.moveDown(3);
  centeredLines(doc, MARGIN, CONTENT_W, [
    { text: "_".repeat(45), bold: false },
    { text: nt.name, bold: true },
    { text: "NOTARIO - PÚBLICO", bold: false }
  ]);

  doc.end();
  return done;
}

// ---------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------

function body(doc: PDFKit.PDFDocument, text: string) {
  doc
    .fillColor(BLACK)
    .font("Times-Roman")
    .fontSize(11)
    .text(text, { align: "justify", lineGap: 2 });
}

function clause(doc: PDFKit.PDFDocument, label: string, text: string) {
  doc.moveDown(0.55);
  doc.fillColor(BLACK).font("Times-Bold").fontSize(11).text(`${label} `, { continued: true });
  doc.font("Times-Roman").text(text, { align: "justify", lineGap: 2 });
}

/** Two centered signature columns (ACREEDOR | DEUDOR). Times renders at absolute x. */
function signatureTable(doc: PDFKit.PDFDocument, deudorNombre: string, repName: string) {
  const colW = CONTENT_W / 2;
  const y = doc.y;
  centeredLines(doc, MARGIN, colW, [
    { text: "_".repeat(35), bold: false },
    { text: getContractConfig().creditor.legalName, bold: true },
    { text: `Repr. ${repName}`, bold: false },
    { text: "EL ACREEDOR", bold: true }
  ]);
  const leftBottom = doc.y;
  doc.y = y;
  centeredLines(doc, MARGIN + colW, colW, [
    { text: "_".repeat(35), bold: false },
    { text: deudorNombre, bold: true },
    { text: "", bold: false },
    { text: "EL DEUDOR", bold: true }
  ]);
  doc.x = MARGIN;
  doc.y = Math.max(leftBottom, doc.y);
}

/** Stack of centered lines within [x, x+w], at the current doc.y. */
function centeredLines(
  doc: PDFKit.PDFDocument,
  x: number,
  w: number,
  lines: Array<{ text: string; bold: boolean }>
) {
  let yy = doc.y;
  for (const ln of lines) {
    doc
      .fillColor(BLACK)
      .font(ln.bold ? "Times-Bold" : "Times-Roman")
      .fontSize(10)
      .text(ln.text || " ", x, yy, { width: w, align: "center", lineGap: 2 });
    yy = doc.y;
  }
}

function joinParts(parts: Array<string | undefined>): string {
  const list = parts.filter(Boolean);
  return list.length ? `${list.join(", ")}, ` : "";
}
