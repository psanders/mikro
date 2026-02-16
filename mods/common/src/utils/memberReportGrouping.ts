/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Grouping logic for member reports: Al día (4-5), Requiere atención (2-3), Crítico (1).
 */
import type { LoanPaymentData } from "./calculatePaymentStatus.js";
import { getPaymentRating, getMissedPaymentsCount } from "./memberReportHelpers.js";

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
 * Minimal member shape for grouping (compatible with ExportedMember and serialized API responses).
 */
export interface MemberForGrouping {
  name: string;
  phone: string;
  preferredPaymentDay?: string | null;
  loans: LoanForGrouping[];
}

/**
 * One row in the simplified report (per loan).
 */
export interface GroupedMemberRow {
  name: string;
  phone: string;
  loanId: number;
  rating: 1 | 2 | 3 | 4 | 5;
  missedCount: number;
}

/**
 * Rows grouped by payment health for the simplified report.
 */
export interface GroupedMemberRows {
  alDia: GroupedMemberRow[];
  requiereAtencion: GroupedMemberRow[];
  critico: GroupedMemberRow[];
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
export function buildGroupedMemberRows(
  members: MemberForGrouping[],
  asOfDate: Date = new Date()
): GroupedMemberRows {
  const alDia: GroupedMemberRow[] = [];
  const requiereAtencion: GroupedMemberRow[] = [];
  const critico: GroupedMemberRow[] = [];

  for (const member of members) {
    for (const loan of member.loans) {
      const data: LoanPaymentData = {
        ...toLoanPaymentData(loan),
        preferredPaymentDay: member.preferredPaymentDay
      };
      const rating = getPaymentRating(data, asOfDate);
      const missedCount = getMissedPaymentsCount(data, asOfDate);

      const row: GroupedMemberRow = {
        name: member.name,
        phone: member.phone,
        loanId: loan.loanId,
        rating,
        missedCount
      };

      if (rating >= 4) alDia.push(row);
      else if (rating >= 2) requiereAtencion.push(row);
      else critico.push(row);
    }
  }

  // Sort: within each group, worst first (by rating asc, then missed desc)
  const sortRows = (rows: GroupedMemberRow[]) =>
    rows.sort((a, b) => {
      if (a.rating !== b.rating) return a.rating - b.rating;
      return b.missedCount - a.missedCount;
    });
  sortRows(critico);
  sortRows(requiereAtencion);
  sortRows(alDia);

  return { alDia, requiereAtencion, critico };
}
