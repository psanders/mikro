/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Reporting foundation helpers: the FIFO waterfall-allocation helper (cumulative
 * coverage crosses cuota boundaries, reversed rows excluded) and the repayment-
 * schedule builder (one row per cuota, due dates from `getDueDateForCycle`).
 */
import { expect } from "chai";
import {
  allocatePaymentsToCuotas,
  buildRepaymentSchedule,
  buildLoanSnapshot,
  getDueDateForCycle,
  ValidationError,
  type AllocationPayment,
  type BuildSnapshotInput,
  type LoanSnapshot
} from "@mikro/common";

const CUOTA = 1000;
const TERM = 5;
const LOAN_START = new Date("2026-01-05T00:00:00.000Z");

function inst(
  amount: number,
  at: string,
  status: AllocationPayment["status"] = "COMPLETED"
): AllocationPayment {
  return { kind: "INSTALLMENT", status, amount, paidAt: at };
}

describe("reporting — waterfall allocation helper", () => {
  it("covers cuota N once cumulative money reaches N × cuota, remainder spills forward", () => {
    // 1000 + 1000 + 500 = 2500 → cuotas 1 & 2 covered, 500 applied to cuota 3.
    const rows = allocatePaymentsToCuotas({
      payments: [
        inst(1000, "2026-01-10T00:00:00Z"),
        inst(1000, "2026-01-17T00:00:00Z"),
        inst(500, "2026-01-24T00:00:00Z", "PARTIAL")
      ],
      cuota: CUOTA,
      termLength: TERM
    });

    expect(rows).to.have.length(TERM);
    expect(rows[0].covered).to.equal(true);
    expect(rows[1].covered).to.equal(true);
    expect(rows[2].covered).to.equal(false);
    expect(rows[2].amountApplied).to.equal(500);
    expect(rows[3].amountApplied).to.equal(0);
    expect(rows[4].covered).to.equal(false);
    // Coverage date of cuota 2 is the second payment (the one that crossed 2000).
    expect(rows[1].coverageDate).to.equal(new Date("2026-01-17T00:00:00Z").toISOString());
    expect(rows[2].coverageDate).to.equal(null);
  });

  it("crosses multiple cuota boundaries in a single payment", () => {
    // One 3200 payment covers cuotas 1..3 and applies 200 to cuota 4.
    const rows = allocatePaymentsToCuotas({
      payments: [inst(3200, "2026-01-10T00:00:00Z")],
      cuota: CUOTA,
      termLength: TERM
    });
    expect(rows.filter((r) => r.covered).map((r) => r.cuota)).to.deep.equal([1, 2, 3]);
    expect(rows[3].amountApplied).to.equal(200);
    const cross = new Date("2026-01-10T00:00:00Z").toISOString();
    expect(rows[0].coverageDate).to.equal(cross);
    expect(rows[2].coverageDate).to.equal(cross);
  });

  it("excludes REVERSED and PENDING rows from every allocation", () => {
    const rows = allocatePaymentsToCuotas({
      payments: [
        inst(1000, "2026-01-10T00:00:00Z"),
        inst(9000, "2026-01-11T00:00:00Z", "REVERSED"),
        inst(9000, "2026-01-12T00:00:00Z", "PENDING")
      ],
      cuota: CUOTA,
      termLength: TERM
    });
    // Only the single 1000 COMPLETED row counts.
    expect(rows[0].covered).to.equal(true);
    expect(rows[1].covered).to.equal(false);
    expect(rows.filter((r) => r.covered)).to.have.length(1);
  });

  it("ignores LATE_FEE rows (only INSTALLMENT money allocates)", () => {
    const rows = allocatePaymentsToCuotas({
      payments: [
        inst(1000, "2026-01-10T00:00:00Z"),
        { kind: "LATE_FEE", status: "COMPLETED", amount: 5000, paidAt: "2026-01-11T00:00:00Z" }
      ],
      cuota: CUOTA,
      termLength: TERM
    });
    expect(rows.filter((r) => r.covered)).to.have.length(1);
  });

  it("throws a structured ValidationError on invalid input and produces no output", () => {
    let thrown: unknown;
    try {
      // Negative cuota fails the schema.
      allocatePaymentsToCuotas({ payments: [], cuota: -1, termLength: TERM });
    } catch (e) {
      thrown = e;
    }
    expect(thrown).to.be.instanceOf(ValidationError);
    expect((thrown as ValidationError).code).to.equal("VALIDATION_ERROR");
    expect((thrown as ValidationError).fieldErrors.length).to.be.greaterThan(0);
  });
});

const POLICY = {
  moraRate: 0.1,
  moraGraceDays: 0,
  moraCapInCuotas: 1,
  moraMinDop: 0,
  moraStopOnDefault: false,
  moraEffectiveFrom: null
};

function snapshotInput(overrides: Partial<BuildSnapshotInput> = {}): BuildSnapshotInput {
  return {
    loanId: 10036,
    customer: { id: "c1", name: "Cliente", nickname: null, preferredPaymentDay: null },
    loan: {
      principal: 5000,
      paymentAmount: CUOTA,
      termLength: TERM,
      paymentFrequency: "WEEKLY",
      status: "ACTIVE",
      createdAt: LOAN_START,
      startingDate: LOAN_START,
      updatedAt: new Date("2026-02-20T00:00:00Z"),
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
    asOf: new Date("2026-02-20T00:00:00Z"),
    ...overrides
  };
}

describe("reporting — repayment-schedule builder", () => {
  const snap: LoanSnapshot = buildLoanSnapshot(snapshotInput());
  const schedule = buildRepaymentSchedule(snap);

  it("returns exactly termLength rows, cuota 1..T", () => {
    expect(schedule).to.have.length(TERM);
    expect(schedule.map((r) => r.cuota)).to.deep.equal([1, 2, 3, 4, 5]);
  });

  it("each row's due date equals getDueDateForCycle for its cuota", () => {
    schedule.forEach((row, i) => {
      const expected = getDueDateForCycle(LOAN_START, i, "WEEKLY", null).toISOString();
      expect(row.dueDate, `cuota ${row.cuota}`).to.equal(expected);
    });
  });

  it("derives status and amount from the allocation helper (paid/partial/overdue)", () => {
    expect(schedule[0].status).to.equal("PAID");
    expect(schedule[1].status).to.equal("PAID");
    expect(schedule[2].status).to.equal("PARTIAL");
    expect(schedule[2].amountApplied).to.equal(400);
    // Cuota 4/5: no money, and their due dates are before asOf → OVERDUE.
    expect(schedule[3].status).to.equal("OVERDUE");
  });
});
