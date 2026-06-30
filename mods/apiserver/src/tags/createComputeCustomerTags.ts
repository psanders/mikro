/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Worst-loan derivation of a customer's AUTO status:/dpd: tags. See QCOBRO.md
 * for the taxonomy and design.md (add-qcobro-integration) for the severity
 * ordering rationale.
 */
import {
  computeAccruedMora,
  getCycleMetrics,
  toLoanPaymentData,
  toCollectedLateFeePayments,
  amountToNumber,
  type Loan,
  type LoansConfig,
  type StatusTag,
  type DpdTag
} from "@mikro/common";

/** Loan shape the tag engine needs: a Loan plus the payments/customer context computeAccruedMora requires. */
export type LoanForTagEngine = Loan & {
  customer: { preferredPaymentDay: string | null };
  payments: Array<{ paidAt: Date; status: string; kind?: string | null; amount?: unknown }>;
};

export interface ComputedCustomerTags {
  statusTag: StatusTag | null;
  dpdTag: DpdTag | null;
}

interface LoanSeverity {
  statusTag: StatusTag;
  dpdTag: DpdTag | null;
  /** Higher = more severe. See design.md decision 2 for the ordering. */
  severity: number;
  /** Tie-break within past_due/written_off: higher days-late wins. */
  daysLate: number;
}

const SEVERITY: Record<StatusTag, number> = {
  "status:defaulted": 7,
  "status:written_off": 6,
  "status:past_due": 5,
  "status:pre_mora": 4,
  "status:current": 3,
  "status:new": 2,
  "status:completed": 1
};

/** DPD aging bucket for days-late < 180 (180+ is always status:written_off / dpd:180_plus). */
function dpdBucket(daysLate: number): DpdTag {
  if (daysLate <= 7) return "dpd:1_7";
  if (daysLate <= 30) return "dpd:8_30";
  if (daysLate <= 60) return "dpd:31_60";
  if (daysLate <= 90) return "dpd:61_90";
  return "dpd:91_180";
}

/**
 * Derive one loan's severity state. CANCELLED loans are filtered out by the
 * caller before this runs. DEFAULTED is trusted verbatim from ops and never
 * derived from days-past-due (design.md decision 3).
 */
function computeLoanSeverity(
  loan: LoanForTagEngine,
  loansPolicy: LoansConfig,
  asOf: Date
): LoanSeverity {
  if (loan.status === "DEFAULTED") {
    return {
      statusTag: "status:defaulted",
      dpdTag: null,
      severity: SEVERITY["status:defaulted"],
      daysLate: 0
    };
  }
  if (loan.status === "COMPLETED") {
    return {
      statusTag: "status:completed",
      dpdTag: null,
      severity: SEVERITY["status:completed"],
      daysLate: 0
    };
  }

  // ACTIVE
  const loanData = toLoanPaymentData(loan);
  const { cyclesElapsed, missedCycles } = getCycleMetrics(loanData, asOf);

  if (cyclesElapsed === 0) {
    return { statusTag: "status:new", dpdTag: null, severity: SEVERITY["status:new"], daysLate: 0 };
  }
  if (missedCycles <= 0) {
    return {
      statusTag: "status:current",
      dpdTag: null,
      severity: SEVERITY["status:current"],
      daysLate: 0
    };
  }

  // moraRate is forced non-zero here on purpose: we only consume daysLate /
  // graceApplied below, never the money amount, and computeAccruedMora
  // short-circuits daysLate to 0 when moraRate <= 0 (interest-free product),
  // which would misclassify a genuinely past-due loan as current.
  const accrued = computeAccruedMora({
    loanData,
    moraRate: 1,
    paymentAmount: amountToNumber(loan.paymentAmount),
    paymentFrequency: loan.paymentFrequency,
    preferredPaymentDay: loan.customer.preferredPaymentDay ?? null,
    loanStart: new Date(loan.startingDate ?? loan.createdAt),
    asOfDate: asOf,
    loanStatus: loan.status,
    loanUpdatedAt: new Date(loan.updatedAt),
    policy: loansPolicy,
    collectedLateFeePayments: toCollectedLateFeePayments(loan)
  });

  if (accrued.graceApplied) {
    return {
      statusTag: "status:pre_mora",
      dpdTag: null,
      severity: SEVERITY["status:pre_mora"],
      daysLate: accrued.daysLate
    };
  }
  if (accrued.daysLate >= 180) {
    return {
      statusTag: "status:written_off",
      dpdTag: "dpd:180_plus",
      severity: SEVERITY["status:written_off"],
      daysLate: accrued.daysLate
    };
  }
  return {
    statusTag: "status:past_due",
    dpdTag: dpdBucket(accrued.daysLate),
    severity: SEVERITY["status:past_due"],
    daysLate: accrued.daysLate
  };
}

/**
 * Worst-loan aggregation across a customer's loans (CANCELLED loans excluded).
 * Returns `{ statusTag: null, dpdTag: null }` when the customer has no
 * eligible loan (no loans, or all CANCELLED) — the caller clears any stale
 * AUTO tags in that case.
 */
export function computeCustomerTags(
  loans: LoanForTagEngine[],
  loansPolicy: LoansConfig,
  asOf: Date = new Date()
): ComputedCustomerTags {
  let best: LoanSeverity | null = null;

  for (const loan of loans) {
    if (loan.status === "CANCELLED") continue;
    const candidate = computeLoanSeverity(loan, loansPolicy, asOf);
    if (
      !best ||
      candidate.severity > best.severity ||
      (candidate.severity === best.severity && candidate.daysLate > best.daysLate)
    ) {
      best = candidate;
    }
  }

  if (!best) return { statusTag: null, dpdTag: null };
  return { statusTag: best.statusTag, dpdTag: best.dpdTag };
}
