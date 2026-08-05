/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The loan-statement report: validation failure produces a structured error and
 * no document, the verification banner reflects `evaluateSnapshot` (pass vs. a
 * named critical failure), and reversed ledger rows are excluded from the
 * page-2 received-payments table (money neither lost nor double-counted).
 */
import { expect } from "chai";
import { readFileSync } from "fs";
import { createRequire } from "module";
import {
  loanStatementReport,
  buildLoanStatementData,
  buildLoanStatementDocument,
  buildKpiCells,
  evaluateSnapshot,
  ValidationError,
  type Font,
  type ReportElement,
  type LoanStatementInput,
  type LoanStatementData
} from "@mikro/common";

const CUOTA = 1000;
const TERM = 5;
const LOAN_START = new Date("2026-01-05T00:00:00.000Z");
const AS_OF = new Date("2026-02-20T00:00:00.000Z");

const POLICY = {
  moraRate: 0.1,
  moraGraceDays: 0,
  moraCapInCuotas: 1,
  moraMinDop: 0,
  moraStopOnDefault: false,
  moraEffectiveFrom: null
};

function baseInput(overrides: Partial<LoanStatementInput> = {}): LoanStatementInput {
  return {
    loanId: 10036,
    customer: { id: "c1", name: "Cliente Uno", nickname: null, preferredPaymentDay: null },
    loan: {
      principal: 5000,
      paymentAmount: CUOTA,
      termLength: TERM,
      paymentFrequency: "WEEKLY",
      status: "ACTIVE",
      createdAt: LOAN_START,
      startingDate: LOAN_START,
      updatedAt: AS_OF,
      nickname: null
    },
    payments: [
      {
        id: "p0",
        kind: "INSTALLMENT",
        status: "COMPLETED",
        amount: 1000,
        paidAt: new Date("2026-01-12T00:00:00Z")
      },
      {
        id: "p1",
        kind: "INSTALLMENT",
        status: "COMPLETED",
        amount: 1000,
        paidAt: new Date("2026-01-19T00:00:00Z")
      },
      {
        id: "p2",
        kind: "INSTALLMENT",
        status: "PARTIAL",
        amount: 400,
        paidAt: new Date("2026-01-26T00:00:00Z")
      }
    ],
    policy: POLICY,
    asOf: AS_OF,
    ...overrides
  };
}

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
    { name: "Inter", data: read("700Bold/Geist_700Bold.ttf"), weight: 700, style: "normal" },
    { name: "Inter", data: read("900Black/Geist_900Black.ttf"), weight: 900, style: "normal" }
  ];
}

const injectedFonts = loadLocalFonts();
const testDeps = { loadFonts: async () => injectedFonts };

/** Flatten all text content of a ReportElement tree for marker assertions. */
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

function documentText(data: LoanStatementData): string[] {
  const doc = buildLoanStatementDocument(data);
  return doc.pages.flatMap((p) => collectText(p.layout));
}

describe("loan-statement report — mora explanation", () => {
  it("names the grace window when a late loan shows zero mora", () => {
    const data = buildLoanStatementData(baseInput({ policy: { ...POLICY, moraGraceDays: 60 } }));
    expect(data.kpis.graceApplied).to.be.true;
    expect(data.kpis.moraAccrued).to.equal(0);
    expect(data.kpis.daysOverdue).to.be.greaterThan(0);
    const text = documentText(data).join(" | ");
    expect(text).to.include("período de gracia de 60 días");
  });

  it("singularizes a one-day grace window", () => {
    const data = buildLoanStatementData(baseInput({ policy: { ...POLICY, moraGraceDays: 60 } }));
    data.kpis.moraGraceDays = 1;
    const text = documentText(data).join(" | ");
    expect(text).to.include("período de gracia de 1 día");
    expect(text).to.not.include("1 días");
  });

  it("keeps the generada/pagada breakdown when mora actually accrued", () => {
    const data = buildLoanStatementData(baseInput());
    expect(data.kpis.graceApplied).to.be.false;
    const text = documentText(data).join(" | ");
    expect(text).to.include("generada");
    expect(text).to.not.include("período de gracia");
    expect(text).to.not.include("En gracia");
  });

  // Orange is this report's alarm colour; a zero waived by grace is the opposite
  // of an alarm, so it must render calm and wear a pill instead.
  it("shows an 'En gracia' pill and drops the orange emphasis when grace applies", () => {
    const grace = buildLoanStatementData(baseInput({ policy: { ...POLICY, moraGraceDays: 60 } }));
    const moraCell = buildKpiCells(grace).find((c) => c.label === "Mora acumulada");
    expect(moraCell?.emphasize).to.equal(false);
    expect(moraCell?.pill?.value).to.equal("En gracia");
    expect(documentText(grace).join(" | ")).to.include("En gracia");

    const accrued = buildLoanStatementData(baseInput());
    const accruedCell = buildKpiCells(accrued).find((c) => c.label === "Mora acumulada");
    expect(accruedCell?.emphasize).to.equal(true);
    expect(accruedCell?.pill).to.equal(undefined);
  });
});

describe("loan-statement report — validation", () => {
  it("rejects invalid/missing input with a structured ValidationError and produces no document", async () => {
    const bad = { loanId: 10036 }; // missing customer/loan/payments/policy entirely

    let jsonErr: unknown;
    try {
      await loanStatementReport.toJson(bad);
    } catch (e) {
      jsonErr = e;
    }
    expect(jsonErr).to.be.instanceOf(ValidationError);
    expect((jsonErr as ValidationError).code).to.equal("VALIDATION_ERROR");

    let pdfResult: Buffer | undefined;
    let pdfErr: unknown;
    try {
      pdfResult = await loanStatementReport.toPdf(bad, testDeps);
    } catch (e) {
      pdfErr = e;
    }
    expect(pdfErr).to.be.instanceOf(ValidationError);
    expect(pdfResult).to.equal(undefined);
  });

  it("rejects a negative loan id", async () => {
    const bad = baseInput({ loanId: -1 });
    let err: unknown;
    try {
      await loanStatementReport.toJson(bad);
    } catch (e) {
      err = e;
    }
    expect(err).to.be.instanceOf(ValidationError);
  });
});

describe("loan-statement report — JSON/PDF parity", () => {
  it("toJson returns the canonical data model; toPdf renders a 2-page PDF from the same data", async () => {
    const input = baseInput();
    const json = await loanStatementReport.toJson(input);
    expect(json.loanId).to.equal(10036);
    expect(json.schedule).to.have.length(TERM);
    expect(json.evalReport.pass).to.equal(true);

    const pdf = await loanStatementReport.toPdf(input, testDeps);
    expect(pdf.subarray(0, 5).toString("latin1")).to.equal("%PDF-");
    const pageCount = (pdf.toString("latin1").match(/\/Type\s*\/Page(?![s])/g) ?? []).length;
    expect(pageCount).to.equal(2);
  });
});

describe("loan-statement report — verification banner", () => {
  it("a healthy loan shows a passing banner naming no failing check", () => {
    const data = buildLoanStatementData(baseInput());
    expect(data.evalReport.criticalFailures).to.deep.equal([]);

    const text = documentText(data).join(" ");
    expect(text).to.include("Verificación del sistema:");
    expect(text).to.include(`${data.evalReport.passCount}/${data.evalReport.results.length}`);
    expect(text).to.not.include("No se puede confirmar");
  });

  it("a critical check failure is surfaced by name, not hidden", () => {
    const good = buildLoanStatementData(baseInput());
    // Corrupt the built snapshot's derived block directly (as the eval-framework
    // suite does) to force a critical failure without hand-deriving a schedule.
    const corruptedSnapshot = JSON.parse(JSON.stringify(good.snapshot));
    corruptedSnapshot.derived.remainingBalance = 999999;
    const corruptedReport = evaluateSnapshot(corruptedSnapshot);
    expect(corruptedReport.criticalFailures.length).to.be.greaterThan(0);

    const data: LoanStatementData = {
      ...good,
      snapshot: corruptedSnapshot,
      evalReport: corruptedReport
    };
    const text = documentText(data).join(" ");
    expect(text).to.include("No se puede confirmar");
    const failingTitle = corruptedReport.results.find(
      (r) => r.id === corruptedReport.criticalFailures[0]
    )!.title;
    expect(text).to.include(failingTitle);
  });
});

describe("loan-statement report — frozen mora window (loan #10029)", () => {
  // Anonymized from a real bug report: BIWEEKLY, cuota 1,200, term 10,
  // disbursed 2026-03-15. The 5 ago charge (RD$76, 19 days from the
  // then-oldest missed due) is the one that froze its window — the same
  // 1,200 payment closed cuota 8 and moved the oldest missed due to 19 jul,
  // which would silently re-derive the charge as RD$68 without the anchor.
  // This regenerates the statement through the REAL validated entrypoint
  // (`loanStatementReport.toJson`, the one path tRPC/CLI/copilot all use —
  // not `buildLoanStatementData` called directly) because the anchor's
  // journey through this report's own Zod input schema is exactly what a
  // unit test on the engine alone (moraAccrualAnchor.test.ts) cannot see.
  const CUOTA = 1200;
  const LOAN_START = new Date(2026, 2, 15);
  const on = (m: number, d: number, h = 12) => new Date(2026, m - 1, d, h);
  const CHARGE_ANCHOR = on(7, 17);

  function loan10029Input(overrides: { anchored: boolean }): LoanStatementInput {
    return {
      loanId: 10029,
      customer: { id: "c1", name: "Cliente 10029", nickname: null, preferredPaymentDay: null },
      loan: {
        principal: CUOTA * 10,
        paymentAmount: CUOTA,
        termLength: 10,
        paymentFrequency: "BIWEEKLY",
        status: "ACTIVE",
        createdAt: LOAN_START,
        startingDate: LOAN_START,
        updatedAt: on(8, 5),
        nickname: null
      },
      payments: [
        { id: "i1", kind: "INSTALLMENT", status: "COMPLETED", amount: 1200, paidAt: on(3, 15) },
        { id: "i2", kind: "INSTALLMENT", status: "COMPLETED", amount: 1200, paidAt: on(4, 2) },
        { id: "i3", kind: "INSTALLMENT", status: "COMPLETED", amount: 1200, paidAt: on(4, 16) },
        { id: "i4", kind: "INSTALLMENT", status: "COMPLETED", amount: 1200, paidAt: on(5, 1) },
        { id: "i5", kind: "INSTALLMENT", status: "COMPLETED", amount: 1176, paidAt: on(5, 30) },
        { id: "i6", kind: "INSTALLMENT", status: "COMPLETED", amount: 1128, paidAt: on(6, 17) },
        { id: "i7", kind: "INSTALLMENT", status: "COMPLETED", amount: 1140, paidAt: on(7, 2) },
        { id: "i8", kind: "INSTALLMENT", status: "COMPLETED", amount: 1200, paidAt: on(7, 17) },
        { id: "i9", kind: "INSTALLMENT", status: "COMPLETED", amount: 1124, paidAt: on(8, 5) },
        { id: "f1", kind: "LATE_FEE", status: "COMPLETED", amount: 24, paidAt: on(5, 30) },
        { id: "f2", kind: "LATE_FEE", status: "COMPLETED", amount: 72, paidAt: on(6, 17) },
        { id: "f3", kind: "LATE_FEE", status: "COMPLETED", amount: 60, paidAt: on(7, 2) },
        {
          id: "f4",
          kind: "LATE_FEE",
          status: "COMPLETED",
          amount: 76,
          paidAt: on(8, 5),
          ...(overrides.anchored ? { moraAccrualFrom: CHARGE_ANCHOR } : {})
        }
      ],
      policy: {
        moraRate: 0.1,
        moraGraceDays: 0,
        moraCapInCuotas: 1,
        moraMinDop: 0,
        moraStopOnDefault: true,
        moraEffectiveFrom: null
      },
      asOf: on(8, 5, 23)
    };
  }

  it("regenerated through toJson, gross mora is never below collected — 76 generada, 76 pagada", async () => {
    const data = await loanStatementReport.toJson(loan10029Input({ anchored: true }));
    expect(data.kpis.grossMora).to.equal(76);
    expect(data.kpis.collectedMora).to.equal(76);
    expect(data.kpis.grossMora).to.be.at.least(data.kpis.collectedMora);
    expect(data.kpis.moraAccrued).to.equal(0);

    const moraCell = buildKpiCells(data).find((c) => c.label === "Mora acumulada");
    expect(moraCell?.subtext).to.equal("RD$76.00 generada − RD$76.00 pagada");
  });

  it("without the anchor reaching the row, the statement reproduces the original bug (68 generada, 8.00 clamped away)", async () => {
    const data = await loanStatementReport.toJson(loan10029Input({ anchored: false }));
    expect(data.kpis.grossMora).to.equal(68);
    expect(data.kpis.collectedMora).to.equal(76);
    expect(data.kpis.moraAccrued).to.equal(0);

    const moraCell = buildKpiCells(data).find((c) => c.label === "Mora acumulada");
    expect(moraCell?.subtext).to.equal("RD$68.00 generada − RD$76.00 pagada");
  });

  it("the over-collected window fails the statement's verification banner, not a clean bill of health", async () => {
    const data = await loanStatementReport.toJson(loan10029Input({ anchored: false }));
    expect(data.evalReport.results.find((r) => r.id === "mora-not-over-collected")?.pass).to.equal(
      false
    );
    expect(data.evalReport.criticalFailures).to.not.include("mora-not-over-collected");

    const anchoredData = await loanStatementReport.toJson(loan10029Input({ anchored: true }));
    expect(
      anchoredData.evalReport.results.find((r) => r.id === "mora-not-over-collected")?.pass
    ).to.equal(true);
  });
});

describe("loan-statement report — reversed entries excluded from the page-2 ledger", () => {
  it("excludes reversed rows from receivedPayments and explains them in the reconciliation note", () => {
    const input = baseInput({
      payments: [
        ...baseInput().payments,
        {
          id: "rev",
          kind: "INSTALLMENT",
          status: "REVERSED",
          amount: 777,
          paidAt: new Date("2026-02-01T00:00:00Z")
        }
      ]
    });
    const data = buildLoanStatementData(input);

    expect(data.reversedCount).to.equal(1);
    expect(data.reversedTotal).to.equal(777);
    expect(data.receivedPayments.some((p) => p.id === "rev")).to.equal(false);
    expect(data.receivedPayments).to.have.length(3);

    const text = documentText(data).join(" ");
    // The reconciliation note explains the exclusion (and reconciles the excluded total)...
    expect(text).to.include("revertido");
    expect(text).to.include("777.00");
    // ...but the received-payments table itself only ever lists the 3 non-reversed rows.
    const tableRows = documentText({ ...data, reversedCount: 0, reversedTotal: 0 }).join(" ");
    expect(tableRows.match(/777\.00/g) ?? []).to.have.length(0);
  });

  it("with no reversed rows, the note says so and the count reconciles", () => {
    const data = buildLoanStatementData(baseInput());
    expect(data.reversedCount).to.equal(0);
    const text = documentText(data).join(" ");
    expect(text).to.include("No hay pagos revertidos");
  });
});
