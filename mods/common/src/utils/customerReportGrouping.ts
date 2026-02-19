/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Grouping logic for customer reports: Al día (4-5), Requiere atención (2-3), Crítico (1).
 */
import type { LoanPaymentData } from "./calculatePaymentStatus.js";
import { getPaymentRating, getMissedPaymentsCount } from "./customerReportHelpers.js";

/**
 * Minimal loan shape for grouping (compatible with ExportedLoan and serialized API responses).
 */
export interface LoanForGrouping {
  loanId: number;
  paymentFrequency: string;
  createdAt: Date;
  payments: Array<{ paidAt: Date }>;
}

/**
 * Minimal customer shape for grouping (compatible with ExportedCustomer and serialized API responses).
 */
export interface CustomerForGrouping {
  name: string;
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
  rating: 1 | 2 | 3 | 4 | 5;
  missedCount: number;
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

function toLoanPaymentData(loan: LoanForGrouping): LoanPaymentData {
  return {
    paymentFrequency: loan.paymentFrequency,
    createdAt: loan.createdAt,
    payments: loan.payments
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
      const data: LoanPaymentData = {
        ...toLoanPaymentData(loan),
        preferredPaymentDay: customer.preferredPaymentDay
      };
      const rating = getPaymentRating(data, asOfDate);
      const missedCount = getMissedPaymentsCount(data, asOfDate);

      const row: GroupedCustomerRow = {
        name: customer.name,
        phone: customer.phone,
        loanId: loan.loanId,
        rating,
        missedCount,
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
