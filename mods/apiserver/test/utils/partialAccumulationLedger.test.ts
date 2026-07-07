/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Regression: real-world (anonymized) weekly-loan ledger where mora-first
 * splitting turned nearly every handover into a PARTIAL row. Under
 * COMPLETED-only counting the loan froze at 4/11 cuotas with mora accruing
 * daily; money-based counting must keep progress and mora sane, both when
 * replaying the ledger through the payment pipeline and when reading the
 * historical rows exactly as they were stored.
 *
 * Loan: WEEKLY, cuota 1,200, term 11, anchored Mon 2026-05-04, preferred
 * day MONDAY (dues Mondays from 05-11), moraRate 0.1 (4 DOP/day on 1,200).
 */
import { expect } from "chai";
import {
  computeAccruedMora,
  computePaymentSplit,
  getCycleMetrics,
  countCuotasCovered,
  type LoanPaymentData,
  type CollectedLateFeePayment
} from "@mikro/common";

const CUOTA = 1200;
const TERM = 11;
const MORA_RATE = 0.1;
const LOAN_START = new Date("2026-05-04T00:00:00.000Z");
const POLICY = {
  moraGraceDays: 0,
  moraCapInCuotas: 1,
  moraMinDop: 0,
  moraStopOnDefault: false,
  moraEffectiveFrom: undefined
};

/** Cash the customer handed over, per visit (13 handovers). */
const HANDOVERS = [
  { at: "2026-05-05T17:21:41.374Z", handed: 1200 },
  { at: "2026-05-11T16:05:42.175Z", handed: 1200 },
  { at: "2026-05-23T15:48:58.240Z", handed: 1000 },
  { at: "2026-05-26T19:45:47.995Z", handed: 1200 },
  { at: "2026-06-02T22:59:56.370Z", handed: 1000 },
  { at: "2026-06-10T19:28:37.078Z", handed: 1232 },
  { at: "2026-06-10T19:33:57.845Z", handed: 1100 },
  { at: "2026-06-16T16:36:49.082Z", handed: 1200 },
  { at: "2026-06-22T19:47:17.800Z", handed: 500 },
  { at: "2026-06-23T20:27:23.449Z", handed: 700 },
  { at: "2026-07-01T22:36:18.280Z", handed: 1000 },
  { at: "2026-07-01T22:44:10.603Z", handed: 200 },
  { at: "2026-07-02T13:35:01.986Z", handed: 540 }
];

/** Installment rows exactly as the production DB stored them (mora-first splits). */
const STORED_INSTALLMENTS = [
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
];

function loanData(payments: LoanPaymentData["payments"]): LoanPaymentData {
  return {
    paymentFrequency: "WEEKLY",
    createdAt: LOAN_START,
    startingDate: LOAN_START,
    termLength: TERM,
    paymentAmount: CUOTA,
    preferredPaymentDay: "MONDAY",
    payments
  };
}

describe("partial-accumulation ledger regression", () => {
  it("replaying the handovers through the pipeline charges minimal mora and never spirals", () => {
    const installments: LoanPaymentData["payments"] = [];
    const lateFees: CollectedLateFeePayment[] = [];
    const moraCharged: number[] = [];

    for (const h of HANDOVERS) {
      const asOf = new Date(h.at);
      const accrued = computeAccruedMora({
        loanData: loanData(installments),
        moraRate: MORA_RATE,
        paymentAmount: CUOTA,
        paymentFrequency: "WEEKLY",
        preferredPaymentDay: "MONDAY",
        loanStart: LOAN_START,
        asOfDate: asOf,
        loanStatus: "ACTIVE",
        policy: POLICY,
        collectedLateFeePayments: lateFees
      });
      const split = computePaymentSplit({
        amount: h.handed,
        expectedCuota: CUOTA,
        accruedMora: accrued.moraAmount
      });

      moraCharged.push(split.lateFeePortion);
      if (split.lateFeePortion > 0) {
        lateFees.push({ paidAt: asOf, amount: split.lateFeePortion, status: "COMPLETED" });
      }
      if (split.installmentPortion > 0) {
        installments.push({
          paidAt: asOf,
          status: split.installmentStatus,
          amount: split.installmentPortion
        });
      }
    }

    // Late once around cuotas 3-5 (small daily fees), then current — no runaway accrual.
    expect(moraCharged).to.deep.equal([0, 0, 0, 4, 4, 8, 0, 0, 0, 0, 0, 0, 0]);
    const totalMora = moraCharged.reduce((a, b) => a + b, 0);
    expect(totalMora).to.equal(16); // the same ledger produced 128 under COMPLETED-only counting

    // After the last handover the customer is one cuota away from settling.
    const final = getCycleMetrics(loanData(installments), new Date("2026-07-06T16:00:00Z"));
    expect(final.paymentsMade).to.equal(10);
    expect(final.missedCycles).to.equal(0);
    expect(TERM - final.paymentsMade).to.equal(1); // receipt "Pagos Pendientes"
  });

  it("heals the historical rows as stored: customer is current, not 5 cycles behind", () => {
    const stored = STORED_INSTALLMENTS.map((p) => ({
      paidAt: new Date(p.at),
      status: p.status,
      amount: p.amount
    }));
    const asOf = new Date("2026-07-06T16:00:00Z");

    const m = getCycleMetrics(loanData(stored), asOf);
    // 11,944 paid → 9 full cuotas covered; 9 cycles elapsed → current.
    expect(m.paymentsMade).to.equal(9);
    expect(m.cyclesElapsed).to.equal(9);
    expect(m.missedCycles).to.equal(0);

    // No mora accrues while current (was 4 DOP/day forever before the fix).
    const accrued = computeAccruedMora({
      loanData: loanData(stored),
      moraRate: MORA_RATE,
      paymentAmount: CUOTA,
      paymentFrequency: "WEEKLY",
      preferredPaymentDay: "MONDAY",
      loanStart: LOAN_START,
      asOfDate: asOf,
      loanStatus: "ACTIVE",
      policy: POLICY,
      collectedLateFeePayments: []
    });
    expect(accrued.moraAmount).to.equal(0);

    // Receipt pending count derived the same way the generator does it.
    const paid = stored.reduce((sum, p) => sum + p.amount, 0);
    expect(paid).to.equal(11944);
    expect(TERM - countCuotasCovered(paid, CUOTA)).to.equal(2);
  });
});
