/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  previewLateFeeSchema,
  type PreviewLateFeeInput,
  type DbClient,
  type Loan,
  getConfig,
  computeAccruedMora,
  amountToNumber,
  toLoanPaymentData,
  toCollectedLateFeePayments
} from "@mikro/common";

type LoanMoraContext = Loan & {
  customer: { preferredPaymentDay: string | null };
  payments: Array<{
    paidAt: Date;
    status: string;
    kind?: string | null;
    amount?: unknown;
  }>;
};

export interface PreviewLateFeeResult {
  /** Net mora still owed (after subtracting collected LATE_FEE for this missed-cycle window). */
  accruedMora: number;
  grossMora: number;
  collectedMora: number;
  daysLate: number;
  missedCycles: number;
  cuota: number;
  suggestedTotal: number;
  moraRate: number;
}

export function createPreviewLateFee(client: DbClient) {
  const fn = async (params: PreviewLateFeeInput): Promise<PreviewLateFeeResult> => {
    const loan = (await client.loan.findUnique({
      where: { loanId: params.loanId },
      include: {
        customer: { select: { preferredPaymentDay: true } },
        payments: {
          where: { status: { in: ["COMPLETED", "PARTIAL", "PENDING"] } }
        }
      }
    })) as LoanMoraContext | null;

    if (!loan) {
      throw new Error(`Loan not found with loanId: ${params.loanId}`);
    }

    const cfg = getConfig();
    const moraRate =
      loan.moraRate != null ? amountToNumber(loan.moraRate) : cfg.loans.defaultMoraRate;
    const montoCuota = amountToNumber(loan.paymentAmount);
    const loanStart = new Date(loan.startingDate ?? loan.createdAt);
    const asOf = params.asOf ?? new Date();

    const loanData = toLoanPaymentData(loan);
    const accrued = computeAccruedMora({
      loanData,
      moraRate,
      paymentAmount: montoCuota,
      paymentFrequency: loan.paymentFrequency,
      preferredPaymentDay: loan.customer.preferredPaymentDay ?? null,
      loanStart,
      asOfDate: asOf,
      loanStatus: loan.status,
      loanUpdatedAt: new Date(loan.updatedAt),
      policy: cfg.loans,
      collectedLateFeePayments: toCollectedLateFeePayments(loan)
    });

    return {
      accruedMora: accrued.moraAmount,
      grossMora: accrued.grossMoraAmount,
      collectedMora: accrued.collectedMora,
      daysLate: accrued.daysLate,
      missedCycles: accrued.missedCycles,
      cuota: montoCuota,
      suggestedTotal: montoCuota + accrued.moraAmount,
      moraRate
    };
  };

  return withErrorHandlingAndValidation(fn, previewLateFeeSchema);
}
