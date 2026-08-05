/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { computePaymentSplit } from "@mikro/common/utils/paymentSplit";
import { getDatabase } from "./database";

export interface QueuePaymentInput {
  loanId: number;
  amount: number;
  method?: "CASH" | "TRANSFER";
  collectedById: string;
  kind?: "INSTALLMENT" | "LATE_FEE";
  cuota?: number;
  mora?: number;
  /** Money still needed to close the cuota in flight (see computePaymentSplit). */
  cuotaRemaining?: number;
  notes?: string;
  lateFeeOverride?: number;
}

export interface QueueLoanNoteInput {
  loanId: number;
  content: string;
  createdById: string;
}

/**
 * Optimistic local row ids for a queued payment. A payment can land as two rows
 * (mora + installment), so both are addressable when the push clears them.
 */
export function installmentRowId(mutationId: number): string {
  return `pending_${mutationId}`;
}

export function lateFeeRowId(mutationId: number): string {
  return `pending_${mutationId}_fee`;
}

export function queuePayment(input: QueuePaymentInput): number {
  const db = getDatabase();
  const now = new Date().toISOString();

  const result = db.runSync(
    "INSERT INTO pending_mutations (type, payload, created_at) VALUES (?, ?, ?)",
    ["createPayment", JSON.stringify(input), now]
  );

  const mutationId = result.lastInsertRowId;

  const loan = db.getFirstSync<{ id: string }>("SELECT id FROM loans WHERE loan_id = ?", [
    input.loanId
  ]);

  if (loan) {
    const split = computePaymentSplit({
      amount: input.amount,
      expectedCuota: input.cuota ?? input.amount,
      cuotaRemaining: input.cuotaRemaining,
      accruedMora: input.mora ?? 0,
      kind: input.kind
    });

    const insertRow = (id: string, amount: number, kind: string, status: string) =>
      db.runSync(
        `INSERT INTO payments (id, amount, paid_at, method, status, kind, loan_id, collected_by_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, amount, now, input.method ?? "CASH", status, kind, loan.id, input.collectedById, now]
      );

    // Mirror the split the server will perform, otherwise the local cache counts
    // mora as installment money and overstates progress until the next pull.
    if (split.lateFeePortion > 0) {
      insertRow(lateFeeRowId(mutationId), split.lateFeePortion, "LATE_FEE", "COMPLETED");
    }
    if (split.installmentPortion > 0) {
      insertRow(
        installmentRowId(mutationId),
        split.installmentPortion,
        "INSTALLMENT",
        split.installmentStatus
      );
    }
  }

  return mutationId;
}

export function queueLoanNote(input: QueueLoanNoteInput): number {
  const db = getDatabase();
  const now = new Date().toISOString();

  const result = db.runSync(
    "INSERT INTO pending_mutations (type, payload, created_at) VALUES (?, ?, ?)",
    ["createLoanNote", JSON.stringify(input), now]
  );

  return result.lastInsertRowId;
}
