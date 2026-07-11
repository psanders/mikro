/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Offline render smoke tests: every report, rasterized end-to-end
 * (satori → resvg → sharp → pdfkit) at stress sizes, with NO apiserver and no
 * network (fonts injected from local TTFs). Two failure classes this guards:
 *
 * 1. The resvg native abort (issue #202): a page whose content overflows the
 *    fixed page height kills the whole node process — it cannot be caught, so
 *    the only acceptable outcome is that these renders complete. Sizes here
 *    deliberately exceed the pre-pagination crash boundary (~46 single-line
 *    rows on one page).
 * 2. Dropped rows (issue #201): every input row must survive pagination onto
 *    some page — asserted by checking the LAST input row's marker text exists
 *    in the composed document.
 *
 * Fixtures are shared with `scripts/render-samples.mjs`, so what this suite
 * proves safe is exactly what gets reviewed visually.
 */
import { expect } from "chai";
import { readFileSync } from "fs";
import { createRequire } from "module";
import {
  renderReportToPdf,
  buildLoanStatementData,
  buildLoanStatementDocument,
  buildDefaultedReportData,
  buildDefaultedReportDocument,
  buildCustomersReportData,
  buildCustomersReportDocument,
  buildRenewalReportData,
  buildRenewalReportDocument,
  buildAccountingReportData,
  buildAccountingReportDocument,
  buildPerformanceReportData,
  buildPerformanceReportDocument,
  loanStatementInputSchema,
  defaultedReportInputSchema,
  customersReportInputSchema,
  renewalReportInputSchema,
  accountingReportInputSchema,
  performanceReportInputSchema,
  type Font,
  type ReportDocument,
  type ReportElement
} from "@mikro/common";
import {
  loanStatementFixture,
  defaultedFixture,
  customersFixture,
  renewalFixture,
  accountingFixture,
  performanceFixture
} from "../../scripts/sampleFixtures.mjs";

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
    { name: "Inter", data: read("500Medium/Geist_500Medium.ttf"), weight: 500, style: "normal" },
    {
      name: "Inter",
      data: read("600SemiBold/Geist_600SemiBold.ttf"),
      weight: 600,
      style: "normal"
    },
    { name: "Inter", data: read("700Bold/Geist_700Bold.ttf"), weight: 700, style: "normal" }
  ];
}

const injectedFonts = loadLocalFonts();
const testDeps = { loadFonts: async () => injectedFonts };

/** Flatten every text node in a document for "row survived pagination" assertions. */
function documentText(doc: ReportDocument): string {
  const out: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === "object" && "props" in (node as ReportElement)) {
      const children = (node as ReportElement).props.children;
      if (typeof children === "string") out.push(children);
      else if (children) walk(children);
    }
  };
  doc.pages.forEach((p) => walk(p.layout));
  return out.join("\n");
}

function countPdfPages(pdf: Buffer): number {
  const matches = pdf.toString("latin1").match(/\/Type\s*\/Page(?![s])/g);
  return matches ? matches.length : 0;
}

interface SmokeCase {
  name: string;
  /** Build the composed document from the raw fixture (validating input first). */
  build: () => ReportDocument;
  /** Text that must appear in the composed document — the LAST input row's marker. */
  lastRowMarker: string;
  /** The stress input is sized to paginate: require more than one page. */
  expectMultiPage: boolean;
}

const CASES: SmokeCase[] = [
  {
    // 60 daily cuotas — well past the ~46-row single-page crash boundary.
    name: "loan statement (60 daily cuotas)",
    build: () =>
      buildLoanStatementDocument(
        buildLoanStatementData(
          loanStatementInputSchema.parse(
            loanStatementFixture({ termLength: 60, frequency: "DAILY" })
          )
        )
      ),
    lastRowMarker: "60",
    expectMultiPage: true
  },
  {
    // 40 at-risk loans with long LLM-style notes → table pages + notes pages.
    name: "defaulted (40 rows, long notes)",
    build: () =>
      buildDefaultedReportDocument(
        buildDefaultedReportData(defaultedReportInputSchema.parse(defaultedFixture(40)))
      ),
    lastRowMarker: "#10068", // 10029 + 39
    expectMultiPage: true
  },
  {
    name: "customers (200 rows)",
    build: () =>
      buildCustomersReportDocument(
        buildCustomersReportData(customersReportInputSchema.parse(customersFixture(200)))
      ),
    lastRowMarker: "#10220", // 10021 + 199
    expectMultiPage: true
  },
  {
    name: "renewal (120 rows)",
    build: () =>
      buildRenewalReportDocument(
        buildRenewalReportData(renewalReportInputSchema.parse(renewalFixture(120)))
      ),
    lastRowMarker: "#10171", // 10052 + 119
    expectMultiPage: true
  },
  {
    name: "accounting (150 movimientos)",
    build: () =>
      buildAccountingReportDocument(
        buildAccountingReportData(accountingReportInputSchema.parse(accountingFixture(150)))
      ),
    lastRowMarker: "Movimientos",
    expectMultiPage: true
  },
  {
    name: "performance (narrative)",
    build: () =>
      buildPerformanceReportDocument(
        buildPerformanceReportData(performanceReportInputSchema.parse(performanceFixture()))
      ),
    lastRowMarker: "Recomendación",
    expectMultiPage: false
  }
];

describe("reporting — offline render smoke (all reports, stress sizes)", function () {
  // Full rasterization of many pages; generous budget so CI machines pass.
  this.timeout(120000);

  for (const c of CASES) {
    it(`${c.name} renders a valid PDF without crashing and drops no rows`, async () => {
      const doc = c.build();

      const text = documentText(doc);
      expect(text, `last input row missing from composed document`).to.include(c.lastRowMarker);
      if (c.expectMultiPage) {
        expect(doc.pages.length, "stress input should paginate").to.be.greaterThan(1);
      }

      // The real smoke: rasterize every page. An unpaginated overflow would
      // abort the process here (not throw), so reaching the assertions below
      // IS the test.
      const pdf = await renderReportToPdf(doc, testDeps);
      expect(pdf.subarray(0, 5).toString("latin1")).to.equal("%PDF-");
      expect(countPdfPages(pdf)).to.equal(doc.pages.length);
    });
  }
});
