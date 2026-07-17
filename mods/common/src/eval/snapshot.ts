/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The canonical loan snapshot — one JSON that is the single substrate for the
 * collections evaluation framework. It is produced by a PURE builder shared
 * everywhere: the apiserver runs it over Prisma, mobile (Phase 2) runs it over
 * its SQLite mirror, and the check registry runs over the result. There is no
 * parallel reimplementation of the derived numbers anywhere else.
 *
 *  - `terms`   : loan configuration + resolved mora policy.
 *  - `ledger`  : ALL payments raw — every kind, every status (incl. REVERSED and
 *                PENDING). Nothing filtered. This is raw truth.
 *  - `derived` : what the collector app shows, computed via the existing engine
 *                only (getCycleMetrics / countCuotasCovered / computeAccruedMora).
 *                This is computed truth. Bugs live in the gap between the two,
 *                which the checks measure.
 */
// Imported directly from their source files (not the `../utils/index.js`
// barrel) so this module stays safe for React Native / Jest: the barrel also
// re-exports `renewalReportHelpers`, which pulls in `config.ts` and the
// ESM-only `yaml` package — node/CLI-only dependencies with no place in a
// bundle that must also run inside the mobile app offline.
import {
  getCycleMetrics,
  getDueDateForCycle,
  type LoanPaymentData
} from "../utils/calculatePaymentStatus.js";
import { daysLateFromOldestDue, computeAccruedMora } from "../utils/lateFee.js";
import type { PaymentKind, PaymentStatus } from "../schemas/payment.js";
import type { LoanStatus } from "../schemas/loan.js";

/** One raw payment row, framework-agnostic (amounts as plain numbers, dates as Date). */
export interface SnapshotPayment {
  id: string;
  kind: PaymentKind;
  status: PaymentStatus;
  amount: number;
  paidAt: Date;
  method?: string | null;
  collectedById?: string | null;
  collectedByName?: string | null;
  linkedPaymentId?: string | null;
  notes?: string | null;
}

/** Resolved mora policy (loan override already folded into `moraRate`). */
export interface SnapshotMoraPolicy {
  moraRate: number;
  moraGraceDays: number;
  moraCapInCuotas: number;
  moraMinDop: number;
  moraStopOnDefault: boolean;
  moraEffectiveFrom: string | null;
}

/** Builder input — normalized so both Prisma and SQLite callers can produce it. */
export interface BuildSnapshotInput {
  loanId: number;
  customer: {
    id: string;
    name: string;
    nickname?: string | null;
    preferredPaymentDay: string | null;
  };
  loan: {
    principal: number;
    /** Cuota — expected amount per period. */
    paymentAmount: number;
    termLength: number;
    paymentFrequency: string;
    status: LoanStatus;
    createdAt: Date;
    startingDate: Date | null;
    updatedAt: Date;
    nickname: string | null;
  };
  /** ALL payments, unfiltered. */
  payments: SnapshotPayment[];
  policy: SnapshotMoraPolicy;
  /** Evaluation instant. Defaults to now. */
  asOf?: Date;
}

export interface SnapshotDerived {
  /** Completed cuotas by money (capped at term). */
  cuotasCovered: number;
  /** term − cuotasCovered. */
  pendingPayments: number;
  /** The cuota currently being collected (cuotasCovered + 1, capped). */
  installmentNumber: number;
  termLength: number;
  /** Sum of INSTALLMENT COMPLETED+PARTIAL amounts (≤ asOf). */
  totalInstallmentPaid: number;
  /** Sum of non-reversed LATE_FEE amounts (≤ asOf). */
  totalLateFeePaid: number;
  /** max(0, term·cuota − totalInstallmentPaid). */
  remainingBalance: number;
  /** Net mora still owed. */
  moraAccrued: number;
  grossMora: number;
  collectedMora: number;
  /** True when daysLate is within moraGraceDays, so no mora accrued despite being late. */
  graceApplied: boolean;
  daysLate: number;
  missedCycles: number;
  nextDueDate: string;
  daysOverdue: number;
  isOverdue: boolean;
  fullyPaid: boolean;
}

export interface LoanSnapshot {
  loanId: number;
  asOf: string;
  customer: {
    id: string;
    name: string;
    nickname: string | null;
    preferredPaymentDay: string | null;
  };
  terms: {
    principal: number;
    cuota: number;
    termLength: number;
    paymentFrequency: string;
    status: LoanStatus;
    nickname: string | null;
    createdAt: string;
    startingDate: string | null;
    moraPolicy: SnapshotMoraPolicy;
  };
  ledger: Array<
    Omit<SnapshotPayment, "paidAt"> & {
      paidAt: string;
      /** True for INSTALLMENT rows in COMPLETED/PARTIAL that count toward cuotas. */
      countsTowardCuotas: boolean;
    }
  >;
  derived: SnapshotDerived;
}

const COUNTABLE: ReadonlySet<PaymentStatus> = new Set(["COMPLETED", "PARTIAL"]);

/** Sum INSTALLMENT COMPLETED+PARTIAL amounts paid at or before `asOf`. */
export function sumInstallmentPaid(payments: SnapshotPayment[], asOf: Date): number {
  return payments
    .filter(
      (p) =>
        p.kind === "INSTALLMENT" &&
        COUNTABLE.has(p.status) &&
        !(new Date(p.paidAt).getTime() > asOf.getTime())
    )
    .reduce((sum, p) => sum + p.amount, 0);
}

/** Sum non-reversed LATE_FEE amounts paid at or before `asOf`. */
export function sumLateFeePaid(payments: SnapshotPayment[], asOf: Date): number {
  return payments
    .filter(
      (p) =>
        p.kind === "LATE_FEE" &&
        p.status !== "REVERSED" &&
        !(new Date(p.paidAt).getTime() > asOf.getTime())
    )
    .reduce((sum, p) => sum + p.amount, 0);
}

/**
 * Build the canonical snapshot. Pure — no I/O. The derived section runs the same
 * `@mikro/common` engine the collector app uses, so eval-over-snapshot is
 * eval-over-what-the-collector-sees.
 */
export function buildLoanSnapshot(input: BuildSnapshotInput): LoanSnapshot {
  const asOf = input.asOf ?? new Date();
  const { loan, customer, payments, policy } = input;
  const cuota = loan.paymentAmount;
  const loanStart = new Date(loan.startingDate ?? loan.createdAt);

  // LoanPaymentData mirrors toLoanPaymentData(): INSTALLMENT rows only, money-based.
  const loanData: LoanPaymentData = {
    paymentFrequency: loan.paymentFrequency,
    createdAt: new Date(loan.createdAt),
    startingDate: loan.startingDate != null ? new Date(loan.startingDate) : null,
    termLength: loan.termLength,
    paymentAmount: cuota,
    preferredPaymentDay: customer.preferredPaymentDay,
    payments: payments
      .filter((p) => p.kind === "INSTALLMENT")
      .map((p) => ({ paidAt: new Date(p.paidAt), status: p.status, amount: p.amount }))
  };

  const metrics = getCycleMetrics(loanData, asOf);
  const cuotasCovered = metrics.paymentsMade;
  const pendingPayments = Math.max(0, loan.termLength - cuotasCovered);
  const installmentNumber = Math.min(cuotasCovered + 1, loan.termLength);

  const totalInstallmentPaid = sumInstallmentPaid(payments, asOf);
  const totalLateFeePaid = sumLateFeePaid(payments, asOf);
  const remainingBalance = Math.max(0, loan.termLength * cuota - totalInstallmentPaid);

  const collectedLateFeePayments = payments
    .filter((p) => p.kind === "LATE_FEE" && p.status !== "REVERSED")
    .map((p) => ({ paidAt: new Date(p.paidAt), amount: p.amount, status: p.status }));

  const mora = computeAccruedMora({
    loanData,
    moraRate: policy.moraRate,
    paymentAmount: cuota,
    paymentFrequency: loan.paymentFrequency,
    preferredPaymentDay: customer.preferredPaymentDay,
    loanStart,
    asOfDate: asOf,
    loanStatus: loan.status,
    loanUpdatedAt: new Date(loan.updatedAt),
    policy,
    collectedLateFeePayments
  });

  const nextDue = getDueDateForCycle(
    loanStart,
    metrics.paymentsMade,
    loan.paymentFrequency,
    customer.preferredPaymentDay
  );
  const daysOverdue = daysLateFromOldestDue(
    loanStart,
    loan.paymentFrequency,
    customer.preferredPaymentDay,
    metrics.paymentsMade,
    metrics.missedCycles,
    asOf
  );

  const derived: SnapshotDerived = {
    cuotasCovered,
    pendingPayments,
    installmentNumber,
    termLength: loan.termLength,
    totalInstallmentPaid: round2(totalInstallmentPaid),
    totalLateFeePaid: round2(totalLateFeePaid),
    remainingBalance: round2(remainingBalance),
    moraAccrued: mora.moraAmount,
    grossMora: mora.grossMoraAmount,
    collectedMora: mora.collectedMora,
    graceApplied: mora.graceApplied,
    daysLate: mora.daysLate,
    missedCycles: mora.missedCycles,
    nextDueDate: nextDue.toISOString(),
    daysOverdue,
    isOverdue: daysOverdue > 0,
    fullyPaid: cuotasCovered >= loan.termLength
  };

  const ledger = [...payments]
    .sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime())
    .map((p) => ({
      id: p.id,
      kind: p.kind,
      status: p.status,
      amount: p.amount,
      paidAt: new Date(p.paidAt).toISOString(),
      method: p.method ?? null,
      collectedById: p.collectedById ?? null,
      collectedByName: p.collectedByName ?? null,
      linkedPaymentId: p.linkedPaymentId ?? null,
      notes: p.notes ?? null,
      countsTowardCuotas: p.kind === "INSTALLMENT" && COUNTABLE.has(p.status)
    }));

  return {
    loanId: input.loanId,
    asOf: asOf.toISOString(),
    customer: {
      id: customer.id,
      name: customer.name,
      nickname: customer.nickname ?? null,
      preferredPaymentDay: customer.preferredPaymentDay
    },
    terms: {
      principal: loan.principal,
      cuota,
      termLength: loan.termLength,
      paymentFrequency: loan.paymentFrequency,
      status: loan.status,
      nickname: loan.nickname,
      createdAt: new Date(loan.createdAt).toISOString(),
      startingDate: loan.startingDate != null ? new Date(loan.startingDate).toISOString() : null,
      moraPolicy: policy
    },
    ledger,
    derived
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
