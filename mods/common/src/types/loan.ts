/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

/**
 * Loan entity type.
 */
export interface Loan {
  id: string;
  loanId: number;
  type: "SAN";
  status: "ACTIVE" | "COMPLETED" | "DEFAULTED" | "CANCELLED";
  principal: number;
  termLength: number;
  paymentAmount: number;
  paymentFrequency: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
  startingDate: Date | null;
  nickname: string | null;
  /** When set, overrides global default mora rate (0–1, e.g. 0.1). */
  moraRate: number | null;
  customerId: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Payment entity type.
 */
export interface Payment {
  id: string;
  amount: number;
  paidAt: Date;
  method: "CASH" | "TRANSFER";
  status: "COMPLETED" | "PARTIAL" | "REVERSED" | "PENDING";
  kind: "INSTALLMENT" | "LATE_FEE";
  linkedPaymentId: string | null;
  notes: string | null;
  loanId: string;
  collectedById: string;
  createdAt: Date;
  updatedAt: Date;
}
