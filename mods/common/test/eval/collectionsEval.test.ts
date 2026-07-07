/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Collections evaluation framework: the snapshot builder produces the same
 * numbers the collector app shows, every check passes on a healthy loan, and
 * each check catches its own violation on a deliberately corrupted snapshot.
 *
 * Loan fixture is the real (anonymized — no customer name, per the standing PII
 * rule) #10034 weekly ledger from PR #138: cuota 1,200, term 11, anchored
 * Mon 2026-05-04, preferred day MONDAY, moraRate 0.1.
 */
import { expect } from "chai";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  buildLoanSnapshot,
  evaluateSnapshot,
  runPortfolioHealthCheck,
  generateSpecMarkdown,
  COLLECTIONS_CHECKS,
  type BuildSnapshotInput,
  type LoanSnapshot
} from "@mikro/common";

const CUOTA = 1200;
const TERM = 11;
const LOAN_START = new Date("2026-05-04T00:00:00.000Z");
const AS_OF = new Date("2026-07-06T16:00:00.000Z");

const POLICY = {
  moraRate: 0.1,
  moraGraceDays: 0,
  moraCapInCuotas: 1,
  moraMinDop: 0,
  moraStopOnDefault: false,
  moraEffectiveFrom: null
};

/** Installment rows exactly as production stored them (mora-first splits). */
const STORED = [
  { at: "2026-05-05T17:21:41.374Z", amount: 1200, status: "COMPLETED" },
  { at: "2026-05-11T16:05:42.175Z", amount: 1200, status: "COMPLETED" },
  { at: "2026-05-23T15:48:58.240Z", amount: 1000, status: "PARTIAL" },
  { at: "2026-05-26T19:45:47.995Z", amount: 1196, status: "PARTIAL" },
  { at: "2026-06-02T22:59:56.370Z", amount: 972, status: "PARTIAL" },
  { at: "2026-06-10T19:28:37.078Z", amount: 1200, status: "COMPLETED" },
  { at: "2026-06-10T19:33:57.845Z", amount: 1100, status: "PARTIAL" },
  { at: "2026-06-16T16:36:49.082Z", amount: 1200, status: "COMPLETED" },
  { at: "2026-06-22T19:47:17.800Z", amount: 476, status: "PARTIAL" },
  { at: "2026-06-23T20:27:23.449Z", amount: 696, status: "PARTIAL" },
  { at: "2026-07-01T22:36:18.280Z", amount: 968, status: "PARTIAL" },
  { at: "2026-07-01T22:44:10.603Z", amount: 200, status: "PARTIAL" },
  { at: "2026-07-02T13:35:01.986Z", amount: 536, status: "PARTIAL" }
] as const;

function baseInput(overrides: Partial<BuildSnapshotInput> = {}): BuildSnapshotInput {
  return {
    loanId: 10034,
    customer: {
      id: "cust-1",
      name: "Cliente Prueba",
      nickname: null,
      preferredPaymentDay: "MONDAY"
    },
    loan: {
      principal: 10000,
      paymentAmount: CUOTA,
      termLength: TERM,
      paymentFrequency: "WEEKLY",
      status: "ACTIVE",
      createdAt: LOAN_START,
      startingDate: LOAN_START,
      updatedAt: AS_OF,
      nickname: null
    },
    payments: STORED.map((p, i) => ({
      id: `p${i}`,
      kind: "INSTALLMENT" as const,
      status: p.status as "COMPLETED" | "PARTIAL",
      amount: p.amount,
      paidAt: new Date(p.at)
    })),
    policy: POLICY,
    asOf: AS_OF,
    ...overrides
  };
}

/** Deep clone so a test can corrupt a snapshot without touching the source. */
function clone(s: LoanSnapshot): LoanSnapshot {
  return JSON.parse(JSON.stringify(s)) as LoanSnapshot;
}

describe("collections eval — snapshot builder", () => {
  const snap = buildLoanSnapshot(baseInput());

  it("derives the collector-facing numbers money-based", () => {
    expect(snap.derived.cuotasCovered).to.equal(9);
    expect(snap.derived.pendingPayments).to.equal(2);
    expect(snap.derived.installmentNumber).to.equal(10);
    expect(snap.derived.totalInstallmentPaid).to.equal(11944);
    expect(snap.derived.remainingBalance).to.equal(TERM * CUOTA - 11944); // 1256
    expect(snap.derived.moraAccrued).to.equal(0);
    expect(snap.derived.missedCycles).to.equal(0);
    expect(snap.derived.fullyPaid).to.equal(false);
  });

  it("keeps the raw ledger unfiltered and sorted", () => {
    expect(snap.ledger).to.have.length(STORED.length);
    for (let i = 1; i < snap.ledger.length; i++) {
      expect(new Date(snap.ledger[i].paidAt).getTime()).to.be.at.least(
        new Date(snap.ledger[i - 1].paidAt).getTime()
      );
    }
  });
});

describe("collections eval — healthy loan passes every check", () => {
  it("all checks green on the anonymized #10034 ledger", () => {
    const report = evaluateSnapshot(buildLoanSnapshot(baseInput()));
    const failed = report.results.filter((r) => !r.pass).map((r) => r.id);
    expect(failed, `unexpected failures: ${failed.join(", ")}`).to.deep.equal([]);
    expect(report.pass).to.equal(true);
    expect(report.passCount).to.equal(COLLECTIONS_CHECKS.length);
  });

  it("reversed and pending installment rows never advance the loan", () => {
    const input = baseInput();
    input.payments.push(
      {
        id: "rev",
        kind: "INSTALLMENT",
        status: "REVERSED",
        amount: 5000,
        paidAt: new Date("2026-06-01T10:00:00Z")
      },
      {
        id: "pend",
        kind: "INSTALLMENT",
        status: "PENDING",
        amount: 5000,
        paidAt: new Date("2026-06-01T10:00:00Z")
      }
    );
    const snap = buildLoanSnapshot(input);
    expect(snap.derived.cuotasCovered).to.equal(9); // unchanged by 10k of reversed/pending
    expect(snap.derived.totalInstallmentPaid).to.equal(11944);
    expect(evaluateSnapshot(snap).pass).to.equal(true);
  });
});

describe("collections eval — each check catches its violation", () => {
  const good = buildLoanSnapshot(baseInput());

  const expectFail = (s: LoanSnapshot, checkId: string) => {
    const report = evaluateSnapshot(s);
    const r = report.results.find((x) => x.id === checkId);
    expect(r, `no such check ${checkId}`).to.not.equal(undefined);
    expect(r!.pass, `${checkId} should have failed`).to.equal(false);
    expect(report.pass).to.equal(false);
  };

  it("pending-count: tampered cuota count", () => {
    const s = clone(good);
    s.derived.cuotasCovered = 5;
    s.derived.pendingPayments = 6;
    expectFail(s, "pending-count");
  });

  it("money-conservation & balance-consistency: wrong balance", () => {
    const s = clone(good);
    s.derived.remainingBalance = 999;
    expectFail(s, "money-conservation");
    expectFail(s, "balance-consistency");
  });

  it("cuotas-covered-bounds: coverage over term", () => {
    const s = clone(good);
    s.derived.cuotasCovered = TERM + 3;
    expectFail(s, "cuotas-covered-bounds");
  });

  it("reversed-and-pending-excluded: total counts a reversed row", () => {
    const s = clone(good);
    s.derived.totalInstallmentPaid += 500; // as if a reversed row leaked in
    expectFail(s, "reversed-and-pending-excluded");
  });

  it("mora-grace-respected: mora inside grace", () => {
    const s = clone(good);
    s.derived.daysLate = 0; // within grace (0)
    s.derived.grossMora = 120;
    expectFail(s, "mora-grace-respected");
  });

  it("mora-cap-respected: mora above cap", () => {
    const s = clone(good);
    s.derived.grossMora = CUOTA * 2; // cap is 1 cuota
    expectFail(s, "mora-cap-respected");
  });

  it("mora-only-when-behind: mora with zero missed cycles", () => {
    const s = clone(good);
    s.derived.moraAccrued = 50;
    s.derived.missedCycles = 0;
    expectFail(s, "mora-only-when-behind");
  });

  it("fully-paid-has-no-dues: paid loan still showing dues", () => {
    const s = clone(good);
    s.derived.fullyPaid = true;
    s.derived.pendingPayments = 2;
    expectFail(s, "fully-paid-has-no-dues");
  });

  it("closed-loan-reconciled: COMPLETED status with money still owed", () => {
    const s = clone(good);
    s.terms.status = "COMPLETED"; // good's remainingBalance is 1256, not zero
    expectFail(s, "closed-loan-reconciled");
  });

  it("closed-loan-reconciled: does not flag DEFAULTED/CANCELLED carrying a balance", () => {
    const defaulted = clone(good);
    defaulted.terms.status = "DEFAULTED";
    const report = evaluateSnapshot(defaulted);
    expect(report.results.find((r) => r.id === "closed-loan-reconciled")!.pass).to.equal(true);

    const cancelled = clone(good);
    cancelled.terms.status = "CANCELLED";
    const report2 = evaluateSnapshot(cancelled);
    expect(report2.results.find((r) => r.id === "closed-loan-reconciled")!.pass).to.equal(true);
  });
});

describe("collections eval — portfolio aggregation", () => {
  it("tallies failing loans and offenders worst-first", () => {
    const healthy = buildLoanSnapshot(baseInput());
    const broken = clone(healthy);
    broken.loanId = 20000;
    broken.customer.name = "Otro Cliente";
    broken.derived.pendingPayments = 99; // breaks pending-count
    broken.derived.remainingBalance = -5; // breaks money/balance

    const report = runPortfolioHealthCheck([healthy, broken]);
    expect(report.loansChecked).to.equal(2);
    expect(report.loansPassing).to.equal(1);
    expect(report.loansFailing).to.equal(1);
    expect(report.offenders[0].loanId).to.equal(20000);
    expect(report.failuresByCheck.map((f) => f.id)).to.include("pending-count");
  });
});

describe("collections eval — generated spec", () => {
  it("mentions every registered check id", () => {
    const md = generateSpecMarkdown();
    for (const c of COLLECTIONS_CHECKS) {
      expect(md, `spec missing ${c.id}`).to.contain(c.id);
    }
  });

  it("committed docs/collections-spec.md is in sync (run `npm run spec:collections`)", () => {
    const committed = readFileSync(resolve(process.cwd(), "docs/collections-spec.md"), "utf8");
    expect(committed).to.equal(generateSpecMarkdown());
  });
});
