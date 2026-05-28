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
  notes?: string;
  lateFeeOverride?: number;
}

export interface QueueLoanNoteInput {
  loanId: number;
  content: string;
  createdById: string;
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
      accruedMora: input.mora ?? 0,
      kind: input.kind
    });

    db.runSync(
      `INSERT INTO payments (id, amount, paid_at, method, status, kind, loan_id, collected_by_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `pending_${mutationId}`,
        input.amount,
        now,
        input.method ?? "CASH",
        split.installmentStatus,
        input.kind ?? "INSTALLMENT",
        loan.id,
        input.collectedById,
        now
      ]
    );
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
