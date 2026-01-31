/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shared utilities for member export commands.
 */
import cliui from "cliui";
import { calculatePaymentStatus } from "@mikro/common";

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

/**
 * Adapter for calculatePaymentStatus that handles tRPC date serialization.
 * tRPC serializes Date objects as ISO strings, so we need to convert them back.
 */
export function getPaymentStatus(loan: SerializedLoan): string {
  return calculatePaymentStatus({
    paymentFrequency: loan.paymentFrequency,
    createdAt: new Date(loan.createdAt),
    payments: loan.payments.map((p) => ({ paidAt: new Date(p.paidAt) }))
  });
}

/**
 * Output members as CSV format to a log function.
 *
 * @param members - Array of member data with loans
 * @param log - Function to output each line (typically this.log from oclif)
 */
export function outputMembersAsCsv(
  members: SerializedMember[],
  log: (message: string) => void
): void {
  log("Nombre,Teléfono,Préstamo,Afiliado por,Lugar de Cobro,Estado,Notas");
  for (const member of members) {
    for (const loan of member.loans) {
      const status = getPaymentStatus(loan);
      const row = [
        `"${member.name}"`,
        member.phone,
        loan.loanId,
        `"${member.referredBy.name}"`,
        `"${member.collectionPoint ?? ""}"`,
        status,
        `"${(member.notes ?? "").replace(/"/g, '""')}"`
      ].join(",");
      log(row);
    }
  }
}

/**
 * Output members as a formatted table to a log function.
 *
 * @param members - Array of member data with loans
 * @param log - Function to output each line (typically this.log from oclif)
 */
export function outputMembersAsTable(
  members: SerializedMember[],
  log: (message: string) => void
): void {
  const ui = cliui({ width: 180 });

  ui.div(
    { text: "NOMBRE", padding: [0, 0, 0, 0], width: 25 },
    { text: "TELÉFONO", padding: [0, 0, 0, 0], width: 15 },
    { text: "PRÉSTAMO", padding: [0, 0, 0, 0], width: 10 },
    { text: "REFERIDOR", padding: [0, 0, 0, 0], width: 20 },
    { text: "LUGAR DE COBRO", padding: [0, 0, 0, 0], width: 40 },
    { text: "ESTADO", padding: [0, 0, 0, 0], width: 15 },
    { text: "NOTAS", padding: [0, 0, 0, 0], width: 30 }
  );

  let loanCount = 0;
  for (const member of members) {
    for (const loan of member.loans) {
      const status = getPaymentStatus(loan);
      ui.div(
        { text: member.name, padding: [0, 0, 0, 0], width: 25 },
        { text: member.phone, padding: [0, 0, 0, 0], width: 15 },
        { text: String(loan.loanId), padding: [0, 0, 0, 0], width: 10 },
        { text: member.referredBy.name, padding: [0, 0, 0, 0], width: 20 },
        { text: member.collectionPoint ?? "", padding: [0, 0, 0, 0], width: 40 },
        { text: status, padding: [0, 0, 0, 0], width: 15 },
        { text: member.notes ?? "", padding: [0, 0, 0, 0], width: 30 }
      );
      loanCount++;
    }
  }

  log(ui.toString());
  log(`\nTotal: ${loanCount} préstamos de ${members.length} miembros`);
}
