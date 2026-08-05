/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Mora is charged against the delinquency state at the moment the collector
 * takes the money, but the installment portion of that same payment can push
 * the loan past a cuota boundary — moving the oldest missed due date forward
 * and, before anchoring, shrinking the window the mora was measured over.
 *
 * Loan #10029 (anonymized, from a real bug report): BIWEEKLY, cuota 1,200,
 * term 10, disbursed 2026-03-15. On 2026-08-05 the collector charged RD$76.00
 * of mora — 19 days from the then-oldest missed due (05 jul, the cuota-8 due
 * date). The same RD$1,200 closed cuota 8, so the oldest missed due became
 * 19 jul and gross fell to RD$68.00, leaving the statement printing
 * "68.00 generada − 76.00 pagada" with the difference clamped away.
 */
import { expect } from "chai";
import {
  computeAccruedMora,
  COLLECTIONS_CHECKS,
  verificationBannerCopy,
  type LoanPaymentData
} from "@mikro/common";

const CUOTA = 1200;
const MORA_RATE = 0.1;
const LOAN_START = new Date(2026, 2, 15);
const on = (month: number, day: number, hour = 12) => new Date(2026, month - 1, day, hour);

const POLICY = {
  moraGraceDays: 0,
  moraCapInCuotas: 1,
  moraMinDop: 0,
  moraStopOnDefault: true,
  moraEffectiveFrom: undefined as string | null | undefined
};

/** INSTALLMENT money, including the 1,124 applied by the disputed collection. */
const INSTALLMENTS: Array<[Date, number]> = [
  [on(3, 15), 1200],
  [on(4, 2), 1200],
  [on(4, 16), 1200],
  [on(5, 1), 1200],
  [on(5, 30), 1176],
  [on(6, 17), 1128],
  [on(7, 2), 1140],
  [on(7, 17), 1200],
  [on(8, 5), 1124]
];

/** LATE_FEE money. The 5 ago charge is the one that froze its window. */
const CHARGE_ANCHOR = on(7, 17);
const FEES: Array<[Date, number]> = [
  [on(5, 30), 24],
  [on(6, 17), 72],
  [on(7, 2), 60],
  [on(8, 5), 76]
];

function accrued(opts: { anchored: boolean; asOf?: Date; reversed?: boolean }) {
  const asOf = opts.asOf ?? on(8, 5, 23);

  const loanData: LoanPaymentData = {
    paymentFrequency: "BIWEEKLY",
    createdAt: LOAN_START,
    startingDate: LOAN_START,
    termLength: 10,
    paymentAmount: CUOTA,
    preferredPaymentDay: null,
    payments: INSTALLMENTS.filter(([at]) => at <= asOf).map(([at, amount]) => ({
      paidAt: at,
      status: "COMPLETED",
      amount
    }))
  };

  const collectedLateFeePayments = FEES.filter(([at]) => at <= asOf).map(([at, amount]) => ({
    paidAt: at,
    amount,
    status: opts.reversed && at.getTime() === on(8, 5).getTime() ? "REVERSED" : "COMPLETED",
    // Only the 5 ago charge was written after anchoring shipped.
    moraAccrualFrom: opts.anchored && at.getTime() === on(8, 5).getTime() ? CHARGE_ANCHOR : null
  }));

  return computeAccruedMora({
    loanData,
    moraRate: MORA_RATE,
    paymentAmount: CUOTA,
    paymentFrequency: "BIWEEKLY",
    preferredPaymentDay: null,
    loanStart: LOAN_START,
    asOfDate: asOf,
    loanStatus: "ACTIVE",
    loanUpdatedAt: LOAN_START,
    policy: { ...POLICY },
    collectedLateFeePayments
  });
}

describe("mora accrual window is frozen at charge time", () => {
  it("without an anchor, the payment shrinks the window it was charged against", () => {
    const r = accrued({ anchored: false });
    expect(r.daysLate).to.equal(17);
    expect(r.grossMoraAmount).to.equal(68);
    expect(r.collectedMora).to.equal(76);
    // The 8.00 difference is clamped out of the net and disappears.
    expect(r.moraAmount).to.equal(0);
  });

  it("with an anchor, gross never falls below what was collected", () => {
    const r = accrued({ anchored: true });
    expect(r.daysLate).to.equal(19);
    expect(r.grossMoraAmount).to.equal(76);
    expect(r.collectedMora).to.equal(76);
    expect(r.moraAmount).to.equal(0);
    expect(r.grossMoraAmount).to.be.at.least(r.collectedMora);
  });

  it("reports the accrual start so the charge can persist it", () => {
    expect(accrued({ anchored: true }).accrualFrom?.getTime()).to.equal(CHARGE_ANCHOR.getTime());
    // Unanchored falls back to the live oldest missed due (19 jul, midnight —
    // due dates carry no time of day).
    expect(accrued({ anchored: false }).accrualFrom?.getTime()).to.equal(on(7, 19, 0).getTime());
  });

  it("keeps accruing from the frozen anchor as time passes", () => {
    const later = accrued({ anchored: true, asOf: on(8, 12, 23) });
    // 26 days from 17 jul, not 24 from 19 jul.
    expect(later.daysLate).to.equal(26);
    expect(later.grossMoraAmount).to.equal(104);
    expect(later.moraAmount).to.equal(28);
  });

  it("a reversed charge releases its anchor", () => {
    const r = accrued({ anchored: true, reversed: true });
    expect(r.daysLate).to.equal(17);
    expect(r.grossMoraAmount).to.equal(68);
    // The reversed fee is excluded from collected as well.
    expect(r.collectedMora).to.equal(0);
  });
});

describe("over-collected mora is reported, not clamped away", () => {
  const check = COLLECTIONS_CHECKS.find((c) => c.id === "mora-not-over-collected");
  const netCheck = COLLECTIONS_CHECKS.find((c) => c.id === "mora-net-nonneg");

  const snapshotWith = (grossMora: number, collectedMora: number) =>
    ({
      derived: { grossMora, collectedMora, moraAccrued: Math.max(0, grossMora - collectedMora) }
    }) as never;

  it("is registered as a check", () => {
    expect(check, "mora-not-over-collected is registered").to.not.equal(undefined);
    expect(check!.severity).to.equal("warning");
  });

  it("fails when collected exceeds gross — the pre-anchor loan", () => {
    const r = check!.run(snapshotWith(68, 76));
    expect(r.pass).to.equal(false);
    expect(r.explanation).to.contain("8.00");
  });

  it("passes once the window is frozen", () => {
    expect(check!.run(snapshotWith(76, 76)).pass).to.equal(true);
  });

  it("passes when mora is only partly collected", () => {
    expect(check!.run(snapshotWith(96, 24)).pass).to.equal(true);
  });

  it("does not duplicate the netting invariant", () => {
    // The clamp still holds on the over-collected loan, which is exactly why
    // asserting it alone reported a clean bill of health.
    expect(netCheck!.run(snapshotWith(68, 76)).pass).to.equal(true);
  });
});

describe("statement banner never claims a clean ledger over a failed control", () => {
  const result = (id: string, pass: boolean, severity: "critical" | "warning") => ({
    id,
    title:
      id === "mora-not-over-collected" ? "Mora collected never exceeds the mora generated" : id,
    severity,
    class: "consistency" as const,
    pass,
    expected: "",
    actual: "",
    explanation: "8.00 more than the window produced."
  });

  const report = (results: ReturnType<typeof result>[]) => ({
    results,
    passCount: results.filter((r) => r.pass).length,
    criticalFailures: results.filter((r) => !r.pass && r.severity === "critical").map((r) => r.id)
  });

  it("claims consistency only when every control passed", () => {
    const copy = verificationBannerCopy(
      report([result("pending-count", true, "critical")]) as never
    );
    expect(copy.tone).to.equal("pass");
    expect(copy.explanation).to.contain("consistente");
  });

  it("does not claim consistency when a warning-level control failed", () => {
    const copy = verificationBannerCopy(
      report([
        result("pending-count", true, "critical"),
        result("mora-not-over-collected", false, "warning")
      ]) as never
    );
    expect(copy.tone).to.not.equal("pass");
    expect(copy.explanation).to.not.contain("El libro de pagos es consistente");
    expect(copy.explanation).to.contain("Mora collected never exceeds");
    expect(copy.headline).to.contain("1/2");
  });

  it("still reports a critical failure as a failure", () => {
    const copy = verificationBannerCopy(
      report([result("money-conservation", false, "critical")]) as never
    );
    expect(copy.tone).to.equal("fail");
    expect(copy.explanation).to.contain("No se puede confirmar");
  });
});
