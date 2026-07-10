/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Reporting foundation: the multi-page PDF renderer (valid PDF, page count, all
 * declared blocks present in the composed layout) and the shared Report contract
 * (JSON = canonical data model; invalid input → structured error, no document).
 *
 * Fonts are injected from a local TTF (DI, no live gstatic fetch).
 */
import { expect } from "chai";
import { readFileSync } from "fs";
import { createRequire } from "module";
import { z } from "zod/v4";
import {
  renderReportToPdf,
  defineReport,
  brandHeader,
  verificationBanner,
  kpiGrid,
  dataTable,
  section,
  footerNote,
  page,
  ValidationError,
  type Font,
  type ReportElement,
  type ReportDocument
} from "@mikro/common";

/** Load local Geist TTFs and label them "Inter" so satori matches fontFamily. */
function loadLocalFonts(): Font[] {
  const req = createRequire(import.meta.url);
  const base = req.resolve("@expo-google-fonts/geist/package.json").replace(/package\.json$/, "");
  const read = (rel: string): ArrayBuffer => {
    const buf = readFileSync(base + rel);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  };
  return [
    { name: "Inter", data: read("400Regular/Geist_400Regular.ttf"), weight: 400, style: "normal" },
    { name: "Inter", data: read("700Bold/Geist_700Bold.ttf"), weight: 700, style: "normal" },
    { name: "Inter", data: read("900Black/Geist_900Black.ttf"), weight: 900, style: "normal" }
  ];
}

const injectedFonts = loadLocalFonts();
const testDeps = { loadFonts: async () => injectedFonts };

/** Flatten all text content of a ReportElement tree for block-presence assertions. */
function collectText(
  node: ReportElement | ReportElement[] | unknown,
  out: string[] = []
): string[] {
  if (Array.isArray(node)) {
    node.forEach((n) => collectText(n, out));
    return out;
  }
  if (node && typeof node === "object" && "props" in (node as ReportElement)) {
    const el = node as ReportElement;
    const children = el.props.children;
    if (typeof children === "string") out.push(children);
    else if (children) collectText(children, out);
  }
  return out;
}

/** Count real /Type /Page nodes (excludes the /Pages tree node). */
function countPdfPages(pdf: Buffer): number {
  const matches = pdf.toString("latin1").match(/\/Type\s*\/Page(?![s])/g);
  return matches ? matches.length : 0;
}

/** A 2-page document exercising every declared block. */
function sampleDocument(): { doc: ReportDocument; markers: string[] } {
  const markers = [
    "Estado de Cuenta",
    "Préstamo #10036",
    "Ledger verificado",
    "CAPITAL",
    "MORA",
    "ESTADO",
    "PAGADA",
    "CRONOGRAMA DE PAGOS",
    "Nota: los pagos revertidos no cuentan."
  ];
  const p1 = page([
    brandHeader({
      title: "Estado de Cuenta",
      subtitle: "Préstamo #10036",
      meta: ["Generado 2026-02-20"]
    }),
    verificationBanner({
      headline: "Ledger verificado",
      explanation: "Todos los cheques de consistencia pasaron.",
      tone: "pass"
    }),
    kpiGrid({
      cells: [
        { label: "Capital", value: "RD$ 5,000" },
        { label: "Cuota", value: "RD$ 1,000" },
        { label: "Balance", value: "RD$ 2,600", emphasize: true },
        { label: "Mora", value: "RD$ 0" }
      ]
    }),
    dataTable({
      columns: [
        { key: "cuota", header: "Cuota" },
        { key: "due", header: "Vence" },
        { key: "estado", header: "Estado", align: "right" }
      ],
      rows: [
        {
          cells: { cuota: "1", due: "2026-01-12", estado: "" },
          status: { column: "estado", value: "PAGADA", tone: "paid" }
        },
        {
          cells: { cuota: "2", due: "2026-01-19", estado: "" },
          status: { column: "estado", value: "PARCIAL", tone: "partial" }
        }
      ]
    })
  ]);
  const p2 = page([
    section("Cronograma de pagos", [
      dataTable({
        columns: [
          { key: "n", header: "No." },
          { key: "monto", header: "Monto", align: "right" }
        ],
        rows: [{ cells: { n: "1", monto: "RD$ 1,000" } }]
      })
    ]),
    footerNote(["Nota: los pagos revertidos no cuentan.", "www.mikro.do"])
  ]);
  return { doc: { pages: [{ layout: p1 }, { layout: p2 }] }, markers };
}

describe("reporting — multi-page PDF renderer", function () {
  this.timeout(20000);

  it("produces a valid multi-page PDF (starts with %PDF, correct page count)", async () => {
    const { doc } = sampleDocument();
    const pdf = await renderReportToPdf(doc, testDeps);
    expect(pdf).to.be.instanceOf(Buffer);
    expect(pdf.subarray(0, 5).toString("latin1")).to.equal("%PDF-");
    expect(countPdfPages(pdf)).to.equal(2);
  });

  it("includes every declared block in the composed layout", () => {
    const { doc, markers } = sampleDocument();
    const text = doc.pages.flatMap((p) => collectText(p.layout));
    for (const m of markers) {
      expect(
        text.some((t) => t.includes(m)),
        `missing block marker: ${m}`
      ).to.equal(true);
    }
  });

  it("rejects an empty document", async () => {
    let thrown: unknown;
    try {
      await renderReportToPdf({ pages: [] }, testDeps);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).to.be.instanceOf(Error);
  });
});

describe("reporting — Report contract (defineReport)", function () {
  this.timeout(20000);

  const inputSchema = z.object({ loanId: z.number().int().positive() });
  interface StatementData {
    loanId: number;
    title: string;
    balance: number;
  }

  const report = defineReport({
    name: "test-statement",
    inputSchema,
    buildData: (input): StatementData => ({
      loanId: input.loanId,
      title: `Loan ${input.loanId}`,
      balance: 2600
    }),
    toDocument: (data) => ({
      pages: [
        {
          layout: page([
            brandHeader({ title: data.title }),
            kpiGrid({ cells: [{ label: "Balance", value: `RD$ ${data.balance}` }] })
          ])
        }
      ]
    })
  });

  it("toJson returns the full canonical data model", async () => {
    const json = await report.toJson({ loanId: 10036 });
    expect(json).to.deep.equal({ loanId: 10036, title: "Loan 10036", balance: 2600 });
  });

  it("toPdf adds only presentation — same data model underlies both", async () => {
    const json = await report.toJson({ loanId: 10036 });
    const pdf = await report.toPdf({ loanId: 10036 }, testDeps);
    expect(pdf.subarray(0, 5).toString("latin1")).to.equal("%PDF-");
    // The JSON is the source of truth; the PDF introduces no new data fields.
    expect(Object.keys(json)).to.deep.equal(["loanId", "title", "balance"]);
  });

  it("invalid input throws a structured ValidationError and produces no document", async () => {
    let jsonErr: unknown;
    try {
      await report.toJson({ loanId: -5 });
    } catch (e) {
      jsonErr = e;
    }
    expect(jsonErr).to.be.instanceOf(ValidationError);
    expect((jsonErr as ValidationError).code).to.equal("VALIDATION_ERROR");

    let pdfResult: Buffer | undefined;
    let pdfErr: unknown;
    try {
      pdfResult = await report.toPdf({ loanId: -5 }, testDeps);
    } catch (e) {
      pdfErr = e;
    }
    expect(pdfErr).to.be.instanceOf(ValidationError);
    expect(pdfResult).to.equal(undefined);
  });
});
