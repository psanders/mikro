/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Regression: the receipt handed to the customer did not add up. Loan #10029
 * (anonymized from a real bug report) — BIWEEKLY, cuota 1,200, term 10,
 * disbursed 2026-03-15. On 2026-08-05 the customer handed over 1,200; the
 * server correctly stored LATE_FEE 76 + INSTALLMENT 1,124, but the printed
 * receipt read:
 *
 *   Cuota 1,200.00 | Mora 76.00 | Total 1,200.00 | Pagos Pendientes 3 | "Parcial P8"
 *
 * Cuota + Mora (1,276) did not equal the Total (1,200) because the collection
 * screen passed the *scheduled* cuota and the *full accrued* mora instead of
 * the split; the pending count and the "Parcial" label came from judging the
 * payment against a whole cuota while 1,044 was already sitting on cuota 8.
 */
import { expect } from "chai";
import {
  computePaymentSplit,
  countCuotasCovered,
  cuotaRemainingToClose,
  amountPastDue
} from "@mikro/common";

const CUOTA = 1200;
const TERM = 10;

/** INSTALLMENT money applied before the disputed 2026-08-05 collection. */
const INSTALLMENTS_BEFORE = [1200, 1200, 1200, 1200, 1176, 1128, 1140, 1200];
/** Mora accrued and quoted to the collector at that moment. */
const ACCRUED_MORA = 76;
/** Cash the customer handed over. */
const HANDED_OVER = 1200;

describe("receipt fields for loan #10029 (payment that spans two cuotas)", () => {
  const paidBefore = INSTALLMENTS_BEFORE.reduce((a, b) => a + b, 0);

  const split = computePaymentSplit({
    amount: HANDED_OVER,
    expectedCuota: CUOTA,
    cuotaRemaining: cuotaRemainingToClose(paidBefore, CUOTA),
    accruedMora: ACCRUED_MORA
  });

  it("splits the cash mora-first, exactly as the ledger recorded it", () => {
    expect(paidBefore).to.equal(9444);
    expect(split.lateFeePortion).to.equal(76);
    expect(split.installmentPortion).to.equal(1124);
    expect(split.rowCount).to.equal(2);
  });

  it("receipt cuota + mora equal the total handed over", () => {
    expect(split.installmentPortion + split.lateFeePortion).to.equal(HANDED_OVER);
  });

  it("counts 2 pending cuotas after the payment, not 3", () => {
    const coveredAfter = countCuotasCovered(paidBefore + split.installmentPortion, CUOTA);
    expect(coveredAfter).to.equal(8);
    expect(Math.max(0, TERM - coveredAfter)).to.equal(2);
  });

  it("is not labelled Parcial — 156 closed cuota 8 and 968 went to cuota 9", () => {
    expect(cuotaRemainingToClose(paidBefore, CUOTA)).to.equal(156);
    expect(split.installmentStatus).to.equal("COMPLETED");
  });

  it("still reports PARTIAL when the cash falls short of closing the cuota", () => {
    const short = computePaymentSplit({
      amount: 200,
      expectedCuota: CUOTA,
      cuotaRemaining: cuotaRemainingToClose(paidBefore, CUOTA),
      accruedMora: ACCRUED_MORA
    });
    expect(short.lateFeePortion).to.equal(76);
    expect(short.installmentPortion).to.equal(124);
    expect(short.installmentStatus).to.equal("PARTIAL");
  });

  describe("amount past due on the collector screen", () => {
    const paidAfter = paidBefore + split.installmentPortion;

    it("quotes every overdue remainder, not a single cuota", () => {
      // 2026-08-05: cuotas 9 (19 jul) and 10 (2 ago) are both due; 968 of
      // cuota 9 is already covered, so 232 + 1,200 is still owed.
      const pastDue = amountPastDue({
        totalInstallmentPaid: paidAfter,
        cuotasCovered: 8,
        missedCycles: 2,
        cuota: CUOTA
      });
      expect(paidAfter).to.equal(10568);
      expect(pastDue).to.equal(1432);
    });

    it("is zero for a customer who is up to date", () => {
      const pastDue = amountPastDue({
        totalInstallmentPaid: 4 * CUOTA,
        cuotasCovered: 4,
        missedCycles: 0,
        cuota: CUOTA
      });
      expect(pastDue).to.equal(0);
    });

    it("counts the shortfall on a single half-covered overdue cuota", () => {
      const pastDue = amountPastDue({
        totalInstallmentPaid: 9444,
        cuotasCovered: 7,
        missedCycles: 1,
        cuota: CUOTA
      });
      expect(pastDue).to.equal(156);
    });
  });

  describe("cuotaRemainingToClose", () => {
    it("returns a whole cuota when nothing is carried over", () => {
      expect(cuotaRemainingToClose(0, CUOTA)).to.equal(CUOTA);
      expect(cuotaRemainingToClose(4 * CUOTA, CUOTA)).to.equal(CUOTA);
    });

    it("returns only what is left on a cuota in flight", () => {
      expect(cuotaRemainingToClose(9444, CUOTA)).to.equal(156);
      expect(cuotaRemainingToClose(10568, CUOTA)).to.equal(232);
    });

    it("works in cents, so a near-complete cuota does not drift", () => {
      // 1,250.10 paid against a 1,250.25 cuota leaves exactly 0.15 — a float
      // modulo here yields 0.1499999999998181.
      expect(cuotaRemainingToClose(1250.1, 1250.25)).to.equal(0.15);
      expect(cuotaRemainingToClose(0.1 + 0.2, 1)).to.equal(0.7);
    });
  });
});
