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
  notes?: string | null;
  memberId: string;
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
  collectedById: string;
  createdAt: Date;
  updatedAt: Date;
}
