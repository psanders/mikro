/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { computePaymentSplit } from "@mikro/common";

describe("computePaymentSplit", () => {
  it("full cuota, no mora → single INSTALLMENT COMPLETED", () => {
    const r = computePaymentSplit({ amount: 1250, expectedCuota: 1250, accruedMora: 0 });
    expect(r.lateFeePortion).to.equal(0);
    expect(r.installmentPortion).to.equal(1250);
    expect(r.installmentStatus).to.equal("COMPLETED");
    expect(r.rowCount).to.equal(1);
  });

  it("cuota + mora (arrears) → split, INSTALLMENT COMPLETED", () => {
    const r = computePaymentSplit({ amount: 1279.17, expectedCuota: 1250, accruedMora: 29.17 });
    expect(r.lateFeePortion).to.be.closeTo(29.17, 0.01);
    expect(r.installmentPortion).to.be.closeTo(1250, 0.01);
    expect(r.installmentStatus).to.equal("COMPLETED");
    expect(r.rowCount).to.equal(2);
  });

  it("kind=LATE_FEE → all to late fee, no installment", () => {
    const r = computePaymentSplit({
      amount: 29.17,
      expectedCuota: 1250,
      accruedMora: 29.17,
      kind: "LATE_FEE"
    });
    expect(r.lateFeePortion).to.equal(29.17);
    expect(r.installmentPortion).to.equal(0);
    expect(r.installmentStatus).to.equal("COMPLETED");
    expect(r.rowCount).to.equal(1);
  });

  it("custom amount = cuota with mora → split, INSTALLMENT PARTIAL", () => {
    const r = computePaymentSplit({ amount: 1250, expectedCuota: 1250, accruedMora: 29.17 });
    expect(r.lateFeePortion).to.be.closeTo(29.17, 0.01);
    expect(r.installmentPortion).to.be.closeTo(1220.83, 0.01);
    expect(r.installmentStatus).to.equal("PARTIAL");
    expect(r.rowCount).to.equal(2);
  });

  it("custom amount < cuota, no mora → single INSTALLMENT PARTIAL", () => {
    const r = computePaymentSplit({ amount: 800, expectedCuota: 1250, accruedMora: 0 });
    expect(r.lateFeePortion).to.equal(0);
    expect(r.installmentPortion).to.equal(800);
    expect(r.installmentStatus).to.equal("PARTIAL");
    expect(r.rowCount).to.equal(1);
  });

  it("custom amount < mora → all to late fee, no installment row", () => {
    const r = computePaymentSplit({ amount: 15, expectedCuota: 1250, accruedMora: 29.17 });
    expect(r.lateFeePortion).to.equal(15);
    expect(r.installmentPortion).to.equal(0);
    expect(r.installmentStatus).to.equal("COMPLETED");
    expect(r.rowCount).to.equal(1);
  });

  it("kind=INSTALLMENT with mora → skips mora, full INSTALLMENT COMPLETED", () => {
    const r = computePaymentSplit({
      amount: 1250,
      expectedCuota: 1250,
      accruedMora: 29.17,
      kind: "INSTALLMENT"
    });
    expect(r.lateFeePortion).to.equal(0);
    expect(r.installmentPortion).to.equal(1250);
    expect(r.installmentStatus).to.equal("COMPLETED");
    expect(r.rowCount).to.equal(1);
  });

  it("epsilon edge: amount ≈ cuota within 1e-9 → COMPLETED (not PARTIAL)", () => {
    const r = computePaymentSplit({
      amount: 1250 - 1e-10,
      expectedCuota: 1250,
      accruedMora: 0
    });
    expect(r.installmentStatus).to.equal("COMPLETED");
  });

  it("lateFeeOverride waives mora entirely", () => {
    const r = computePaymentSplit({
      amount: 1250,
      expectedCuota: 1250,
      accruedMora: 29.17,
      lateFeeOverride: 29.17
    });
    expect(r.lateFeePortion).to.equal(0);
    expect(r.installmentPortion).to.equal(1250);
    expect(r.installmentStatus).to.equal("COMPLETED");
    expect(r.rowCount).to.equal(1);
  });

  it("lateFeeOverride partially waives mora", () => {
    const r = computePaymentSplit({
      amount: 1250,
      expectedCuota: 1250,
      accruedMora: 29.17,
      lateFeeOverride: 20
    });
    expect(r.lateFeePortion).to.be.closeTo(9.17, 0.01);
    expect(r.installmentPortion).to.be.closeTo(1240.83, 0.01);
    expect(r.installmentStatus).to.equal("PARTIAL");
    expect(r.rowCount).to.equal(2);
  });

  it("statusOverride forces COMPLETED even when installment < cuota", () => {
    const r = computePaymentSplit({
      amount: 800,
      expectedCuota: 1250,
      accruedMora: 0,
      statusOverride: "COMPLETED"
    });
    expect(r.installmentPortion).to.equal(800);
    expect(r.installmentStatus).to.equal("COMPLETED");
  });

  it("no mora, no kind → single INSTALLMENT, no split", () => {
    const r = computePaymentSplit({ amount: 650, expectedCuota: 650, accruedMora: 0 });
    expect(r.lateFeePortion).to.equal(0);
    expect(r.installmentPortion).to.equal(650);
    expect(r.installmentStatus).to.equal("COMPLETED");
    expect(r.rowCount).to.equal(1);
  });

  it("cuotaRemaining: closing a half-covered cuota is COMPLETED, not PARTIAL", () => {
    // 1,044 of 1,250 already sits on this cuota, so 206 closes it.
    const r = computePaymentSplit({
      amount: 206,
      expectedCuota: 1250,
      cuotaRemaining: 206,
      accruedMora: 0
    });
    expect(r.installmentPortion).to.equal(206);
    expect(r.installmentStatus).to.equal("COMPLETED");
  });

  it("cuotaRemaining: paying past the remainder into the next cuota is COMPLETED", () => {
    const r = computePaymentSplit({
      amount: 1124,
      expectedCuota: 1200,
      cuotaRemaining: 156,
      accruedMora: 0
    });
    expect(r.installmentStatus).to.equal("COMPLETED");
  });

  it("cuotaRemaining: still PARTIAL when the payment falls short of the remainder", () => {
    const r = computePaymentSplit({
      amount: 100,
      expectedCuota: 1250,
      cuotaRemaining: 206,
      accruedMora: 0
    });
    expect(r.installmentStatus).to.equal("PARTIAL");
  });

  it("cuotaRemaining omitted → judged against a full cuota (unchanged behaviour)", () => {
    const r = computePaymentSplit({ amount: 206, expectedCuota: 1250, accruedMora: 0 });
    expect(r.installmentStatus).to.equal("PARTIAL");
  });

  it("cuotaRemaining <= 0 or larger than a cuota falls back to the full cuota", () => {
    expect(
      computePaymentSplit({ amount: 206, expectedCuota: 1250, cuotaRemaining: 0, accruedMora: 0 })
        .installmentStatus
    ).to.equal("PARTIAL");
    expect(
      computePaymentSplit({
        amount: 206,
        expectedCuota: 1250,
        cuotaRemaining: 9999,
        accruedMora: 0
      }).installmentStatus
    ).to.equal("PARTIAL");
  });

  it("mora comes off the top before the remainder is judged", () => {
    // Hands over 232; 76 is mora, leaving 156 — exactly what closes the cuota.
    const r = computePaymentSplit({
      amount: 232,
      expectedCuota: 1200,
      cuotaRemaining: 156,
      accruedMora: 76
    });
    expect(r.lateFeePortion).to.equal(76);
    expect(r.installmentPortion).to.equal(156);
    expect(r.installmentStatus).to.equal("COMPLETED");
    expect(r.rowCount).to.equal(2);
  });
});
