/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Grouping logic for customer reports: Al día (4-5), Requiere atención (2-3), Crítico (1).
 */
import type { LoanPaymentData } from "./calculatePaymentStatus.js";
import { getCycleMetrics } from "./calculatePaymentStatus.js";
import { getPaymentRating, getMissedPaymentsCount } from "./customerReportHelpers.js";

/**
 * Minimal loan shape for grouping (compatible with ExportedLoan and serialized API responses).
 */
export interface LoanForGrouping {
  loanId: number;
  paymentFrequency: string;
  createdAt: Date;
  startingDate?: Date | null;
  termLength: number;
  /** Cuota size. When present (with payment amounts), progress counting is money-based. */
  paymentAmount?: number;
  payments: Array<{ paidAt: Date; status?: string; amount?: number }>;
  nickname?: string | null;
}

/**
 * Minimal customer shape for grouping (compatible with ExportedCustomer and serialized API responses).
 */
export interface CustomerForGrouping {
  name: string;
  nickname?: string | null;
  phone: string;
  preferredPaymentDay?: string | null;
  loans: LoanForGrouping[];
}

/**
 * One row in the simplified report (per loan).
 */
export interface GroupedCustomerRow {
  name: string;
  phone: string;
  loanId: number;
  /** Display nickname for the customer. Prefers `customer.nickname`; falls back to `loan.nickname`. Empty string when neither is set. */
  nickname: string;
  rating: 1 | 2 | 3 | 4 | 5;
  missedCount: number;
  paymentsMade: number;
  termLength: number;
  paymentFrequency: string;
}

/**
 * Rows grouped by payment health for the simplified report.
 */
export interface GroupedCustomerRows {
  alDia: GroupedCustomerRow[];
  requiereAtencion: GroupedCustomerRow[];
  critico: GroupedCustomerRow[];
}

function toLoanPaymentData(
  loan: LoanForGrouping,
  preferredPaymentDay?: string | null
): LoanPaymentData {
  return {
    paymentFrequency: loan.paymentFrequency,
    createdAt: loan.createdAt,
    startingDate: loan.startingDate ?? null,
    payments: loan.payments,
    paymentAmount: loan.paymentAmount,
    preferredPaymentDay,
    termLength: loan.termLength
  };
}

/**
 * Build report rows grouped by payment health.
 * - Al día: rating 4 or 5
 * - Requiere atención: rating 2 or 3
 * - Crítico: rating 1
 */
export function buildGroupedCustomerRows(
  customers: CustomerForGrouping[],
  asOfDate: Date = new Date()
): GroupedCustomerRows {
  const alDia: GroupedCustomerRow[] = [];
  const requiereAtencion: GroupedCustomerRow[] = [];
  const critico: GroupedCustomerRow[] = [];

  for (const customer of customers) {
    for (const loan of customer.loans) {
      const data: LoanPaymentData = toLoanPaymentData(loan, customer.preferredPaymentDay);
      const rating = getPaymentRating(data, asOfDate);
      const missedCount = getMissedPaymentsCount(data, asOfDate);
      const { paymentsMade } = getCycleMetrics(data, asOfDate);
      const termLength = loan.termLength;

      const customerNick = customer.nickname?.trim();
      const loanNick = loan.nickname?.trim();
      const row: GroupedCustomerRow = {
        name: customer.name,
        phone: customer.phone,
        loanId: loan.loanId,
        nickname: (customerNick && customerNick.length > 0 ? customerNick : loanNick) ?? "",
        rating,
        missedCount,
        paymentsMade,
        termLength,
        paymentFrequency: loan.paymentFrequency
      };

      if (rating >= 4) alDia.push(row);
      else if (rating >= 2) requiereAtencion.push(row);
      else critico.push(row);
    }
  }

  // Sort: within each group, worst first (by rating asc, then missed desc)
  const sortRows = (rows: GroupedCustomerRow[]) =>
    rows.sort((a, b) => {
      if (a.rating !== b.rating) return a.rating - b.rating;
      return b.missedCount - a.missedCount;
    });
  sortRows(critico);
  sortRows(requiereAtencion);
  sortRows(alDia);

  return { alDia, requiereAtencion, critico };
}
