/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * QCobro account balance per `qcobro.balanceBasis`, summed over a customer's
 * relevant (ACTIVE + DEFAULTED) loans. See QCOBRO.md "Balance basis" for the
 * worked example these formulas reconcile against.
 */
import {
  computeAccruedMora,
  getCycleMetrics,
  getRemainingInstallments,
  toLoanPaymentData,
  toCollectedLateFeePayments,
  amountToNumber,
  type Loan,
  type LoansConfig,
  type QCobroBalanceBasis
} from "@mikro/common";

export type LoanForBalance = Loan & {
  customer: { preferredPaymentDay: string | null };
  payments: Array<{ paidAt: Date; status: string; kind?: string | null; amount?: unknown }>;
};

/** Per-loan figures the four balance bases are built from. */
interface LoanBalanceFigures {
  /** Proportional decline: principal * remainingInstallments / termLength. */
  outstandingPrincipal: number;
  moraAmount: number;
  /** Overdue installments not yet paid (missedCycles * paymentAmount), the cure principal. */
  pastDuePrincipal: number;
  nextInstallment: number;
}

function computeLoanBalanceFigures(
  loan: LoanForBalance,
  loansPolicy: LoansConfig,
  asOf: Date
): LoanBalanceFigures {
  const loanData = toLoanPaymentData(loan);
  const principal = amountToNumber(loan.principal);
  const paymentAmount = amountToNumber(loan.paymentAmount);

  const remainingInstallments = getRemainingInstallments(
    { ...loanData, termLength: loan.termLength },
    asOf
  );
  const outstandingPrincipal =
    loan.termLength > 0 ? principal * (remainingInstallments / loan.termLength) : 0;

  const { missedCycles } = getCycleMetrics(loanData, asOf);

  const accrued = computeAccruedMora({
    loanData,
    moraRate: loan.moraRate != null ? amountToNumber(loan.moraRate) : loansPolicy.defaultMoraRate,
    paymentAmount,
    paymentFrequency: loan.paymentFrequency,
    preferredPaymentDay: loan.customer.preferredPaymentDay ?? null,
    loanStart: new Date(loan.startingDate ?? loan.createdAt),
    asOfDate: asOf,
    loanStatus: loan.status,
    loanUpdatedAt: new Date(loan.updatedAt),
    policy: loansPolicy,
    collectedLateFeePayments: toCollectedLateFeePayments(loan)
  });

  return {
    outstandingPrincipal: Math.max(0, outstandingPrincipal),
    moraAmount: accrued.moraAmount,
    pastDuePrincipal: Math.max(0, missedCycles) * paymentAmount,
    nextInstallment: paymentAmount
  };
}

function basisAmount(figures: LoanBalanceFigures, basis: QCobroBalanceBasis): number {
  switch (basis) {
    case "outstanding_with_mora":
      return figures.outstandingPrincipal + figures.moraAmount;
    case "outstanding_principal":
      return figures.outstandingPrincipal;
    case "past_due_amount":
      return figures.pastDuePrincipal + figures.moraAmount;
    case "next_installment":
      return figures.nextInstallment;
  }
}

/**
 * Sum the `balanceBasis` figure across a customer's relevant loans (ACTIVE +
 * DEFAULTED; COMPLETED/CANCELLED contribute nothing).
 */
export function computeCustomerBalance(
  loans: LoanForBalance[],
  basis: QCobroBalanceBasis,
  loansPolicy: LoansConfig,
  asOf: Date = new Date()
): number {
  let total = 0;
  for (const loan of loans) {
    if (loan.status !== "ACTIVE" && loan.status !== "DEFAULTED") continue;
    total += basisAmount(computeLoanBalanceFigures(loan, loansPolicy, asOf), basis);
  }
  return Number(total.toFixed(2));
}
