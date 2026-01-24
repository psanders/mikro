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
  paymentFrequency: "DAILY" | "WEEKLY";
  memberId: string;
  startedAt: Date;
  closedAt: Date | null;
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
  status: "COMPLETED" | "REVERSED" | "PENDING";
  notes: string | null;
  loanId: string;
  collectedById: string | null;
  createdAt: Date;
  updatedAt: Date;
}
