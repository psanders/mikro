/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shared utilities for member export commands.
 */
import cliui from "cliui";
import { getPaymentRating, getMissedPaymentsCount, getLatenessTrend } from "@mikro/common";

/**
 * Loan data as returned from tRPC (dates serialized as strings).
 */
interface SerializedLoan {
  loanId: number;
  paymentFrequency: string;
  createdAt: string | Date;
  payments: Array<{ paidAt: string | Date }>;
}

/**
 * Member data as returned from tRPC export endpoints.
 * Uses optional types since tRPC may serialize nulls as undefined.
 */
export interface SerializedMember {
  name: string;
  phone: string;
  collectionPoint?: string | null;
  notes?: string | null;
  referredBy: { name: string };
  loans: SerializedLoan[];
}

function toLoanData(loan: SerializedLoan) {
  return {
    paymentFrequency: loan.paymentFrequency,
    createdAt: new Date(loan.createdAt),
    payments: loan.payments.map((p) => ({ paidAt: new Date(p.paidAt) }))
  };
}

const STAR = "★";

function ratingToStars(rating: 1 | 2 | 3 | 4 | 5): string {
  return STAR.repeat(rating);
}

export interface MemberReportRow {
  name: string;
  phone: string;
  loanId: number;
  rating: string;
  missedCount: number;
  trend: string;
  referredBy: string;
  collectionPoint: string;
  notes: string;
}

/**
 * Build sorted report rows (rating ascending, then missed count descending).
 */
export function buildMemberReportRows(members: SerializedMember[]): MemberReportRow[] {
  const rows: MemberReportRow[] = [];
  for (const member of members) {
    for (const loan of member.loans) {
      const data = toLoanData(loan);
      rows.push({
        name: member.name,
        phone: member.phone,
        loanId: loan.loanId,
        rating: ratingToStars(getPaymentRating(data)),
        missedCount: getMissedPaymentsCount(data),
        trend: getLatenessTrend(data),
        referredBy: member.referredBy.name,
        collectionPoint: member.collectionPoint ?? "",
        notes: member.notes ?? ""
      });
    }
  }
  rows.sort((a, b) => {
    const ra = a.rating.length;
    const rb = b.rating.length;
    if (ra !== rb) return ra - rb;
    return b.missedCount - a.missedCount;
  });
  return rows;
}

/**
 * Output members as CSV format to a log function.
 * Rows are sorted by rating (1 star first), then missed count descending.
 */
export function outputMembersAsCsv(
  members: SerializedMember[],
  log: (message: string) => void
): void {
  log(
    "Nombre,Teléfono,Préstamo,Rating,Pagos atrasados,Tendencia,Afiliado por,Lugar de Cobro,Notas"
  );
  const rows = buildMemberReportRows(members);
  for (const r of rows) {
    const row = [
      `"${r.name}"`,
      r.phone,
      r.loanId,
      r.rating,
      r.missedCount,
      r.trend,
      `"${r.referredBy}"`,
      `"${r.collectionPoint.replace(/"/g, '""')}"`,
      `"${(r.notes ?? "").replace(/"/g, '""')}"`
    ].join(",");
    log(row);
  }
}

/**
 * Output members as a formatted table to a log function.
 * Rows are sorted by rating (1 star first), then missed count descending.
 */
export function outputMembersAsTable(
  members: SerializedMember[],
  log: (message: string) => void
): void {
  const ui = cliui({ width: 220 });

  ui.div(
    { text: "NOMBRE", padding: [0, 0, 0, 0], width: 25 },
    { text: "TELÉFONO", padding: [0, 0, 0, 0], width: 15 },
    { text: "PRÉSTAMO", padding: [0, 0, 0, 0], width: 10 },
    { text: "RATING", padding: [0, 0, 0, 0], width: 8 },
    { text: "ATRASADOS", padding: [0, 0, 0, 0], width: 10 },
    { text: "TENDENCIA", padding: [0, 0, 0, 0], width: 12 },
    { text: "REFERIDOR", padding: [0, 0, 0, 0], width: 20 },
    { text: "LUGAR DE COBRO", padding: [0, 0, 0, 0], width: 40 },
    { text: "NOTAS", padding: [0, 0, 0, 0], width: 30 }
  );

  const rows = buildMemberReportRows(members);
  for (const r of rows) {
    ui.div(
      { text: r.name, padding: [0, 0, 0, 0], width: 25 },
      { text: r.phone, padding: [0, 0, 0, 0], width: 15 },
      { text: String(r.loanId), padding: [0, 0, 0, 0], width: 10 },
      { text: r.rating, padding: [0, 0, 0, 0], width: 8 },
      { text: String(r.missedCount), padding: [0, 0, 0, 0], width: 10 },
      { text: r.trend, padding: [0, 0, 0, 0], width: 12 },
      { text: r.referredBy, padding: [0, 0, 0, 0], width: 20 },
      { text: r.collectionPoint, padding: [0, 0, 0, 0], width: 40 },
      { text: r.notes ?? "", padding: [0, 0, 0, 0], width: 30 }
    );
  }

  log(ui.toString());
  log(`\nTotal: ${rows.length} préstamos de ${members.length} miembros`);
}
