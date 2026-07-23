/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import {
  createGeneratePerformanceTrend,
  computePerformanceTrendInput
} from "../../src/api/reports/createGeneratePerformanceTrend.js";
import { ValidationError } from "@mikro/common";

/** Minimal loan+installments shape returned by the mocked Prisma findMany. */
function loan(overrides: {
  principal?: number;
  status?: string;
  termLength?: number;
  paymentAmount?: number;
  paymentFrequency?: string;
  createdAt?: Date;
  updatedAt?: Date;
  payments?: Array<{ amount: number; status?: string; paidAt: Date }>;
}) {
  const {
    principal = 1000,
    status = "ACTIVE",
    termLength = 4,
    paymentAmount = 300,
    paymentFrequency = "WEEKLY",
    createdAt = new Date("2026-01-05"),
    updatedAt = createdAt,
    payments = []
  } = overrides;
  return {
    principal,
    status,
    termLength,
    paymentAmount,
    paymentFrequency,
    createdAt,
    updatedAt,
    payments: payments.map((p) => ({
      amount: p.amount,
      status: p.status ?? "COMPLETED",
      paidAt: p.paidAt
    }))
  };
}

const END = new Date("2026-03-31T12:00:00");

/** Find a month by its ISO key in the returned series. */
const byKey = (months: Array<{ monthKey: string }>, key: string) =>
  months.find((m) => m.monthKey === key)!;

describe("computePerformanceTrendInput", () => {
  afterEach(() => sinon.restore());

  it("books monthly interest in the month it is collected, bounded by the as-of date", async () => {
    // Term 4 × 300 cuota on 1000 principal → interest fraction (1200−1000)/1200.
    const client = {
      loan: {
        findMany: sinon.stub().resolves([
          loan({
            principal: 1000,
            termLength: 4,
            paymentAmount: 300,
            payments: [
              { amount: 300, paidAt: new Date("2026-02-20") },
              { amount: 300, paidAt: new Date("2026-03-20") }
            ]
          })
        ])
      }
    };

    const input = await computePerformanceTrendInput(client as never, { endDate: END, months: 3 });

    // Interest per 300 collected = 300 × (200/1200) = 50. No collection in Jan.
    expect(byKey(input.months, "2026-01").operatingProfitDop).to.equal(0);
    expect(byKey(input.months, "2026-02").operatingProfitDop).to.equal(50);
    expect(byKey(input.months, "2026-03").operatingProfitDop).to.equal(50);
    // First strictly-positive month is the "start making money" marker.
    expect(input.breakeven.profitPositive?.monthKey).to.equal("2026-02");
    expect(input.breakeven.profitPositive?.projected).to.equal(false);
  });

  it("recognizes a default's principal loss in the month the loan was marked defaulted", async () => {
    const client = {
      loan: {
        findMany: sinon.stub().resolves([
          loan({
            principal: 1000,
            termLength: 4,
            paymentAmount: 300,
            status: "DEFAULTED",
            createdAt: new Date("2026-01-05"),
            updatedAt: new Date("2026-03-15"),
            payments: [{ amount: 300, paidAt: new Date("2026-01-10") }]
          })
        ])
      }
    };

    const input = await computePerformanceTrendInput(client as never, { endDate: END, months: 3 });

    // Jan: interest on the 300 collected = 50. March: loss = 1000 − 300 = 700 booked.
    expect(byKey(input.months, "2026-01").operatingProfitDop).to.equal(50);
    expect(byKey(input.months, "2026-03").operatingProfitDop).to.equal(-700);
  });

  it("computes PAR30 and default rate as of month-end, excluding closed loans", async () => {
    const client = {
      loan: {
        findMany: sinon.stub().resolves([
          loan({
            principal: 5000,
            termLength: 10,
            paymentAmount: 650,
            status: "DEFAULTED",
            payments: []
          }),
          loan({
            principal: 5000,
            termLength: 10,
            paymentAmount: 650,
            status: "COMPLETED",
            payments: [{ amount: 2600, paidAt: new Date("2026-01-20") }]
          })
        ])
      }
    };

    const input = await computePerformanceTrendInput(client as never, { endDate: END, months: 3 });
    const mar = byKey(input.months, "2026-03");

    expect(mar.parPct).to.equal(100); // only the defaulted loan carries outstanding
    expect(mar.defaultRatePct).to.equal(50); // 5000 defaulted / 10000 total
  });

  it("trims pre-origination months and marks no profit when the book is flat", async () => {
    const client = {
      loan: {
        findMany: sinon.stub().resolves([loan({ createdAt: new Date("2026-03-10"), payments: [] })])
      }
    };

    const input = await computePerformanceTrendInput(client as never, { endDate: END, months: 3 });

    expect(input.months).to.have.length(1);
    expect(input.months[0]!.monthKey).to.equal("2026-03");
    expect(input.period.startDate).to.equal("2026-03-01");
    expect(input.breakeven.profitPositive).to.equal(null);
  });
});

describe("createGeneratePerformanceTrend", () => {
  afterEach(() => sinon.restore());

  it("returns the canonical JSON payload (no PDF) for format 'json'", async () => {
    const client = { loan: { findMany: sinon.stub().resolves([]) } };
    const fn = createGeneratePerformanceTrend(client as never);

    const result = await fn({ endDate: END, months: 3, format: "json" });

    expect(result.mimeType).to.equal("application/json");
    expect(result.pdfBase64).to.equal(undefined);
    expect(result.filename.endsWith(".json")).to.equal(true);
    expect(result.data.months.length).to.be.greaterThan(0);
  });

  it("throws ValidationError for an out-of-range month count without querying", async () => {
    const client = { loan: { findMany: sinon.stub() } };
    const fn = createGeneratePerformanceTrend(client as never);

    try {
      await fn({ months: 1 });
      expect.fail("Expected ValidationError");
    } catch (error) {
      expect(error).to.be.instanceOf(ValidationError);
      expect(client.loan.findMany.called).to.equal(false);
    }
  });
});
