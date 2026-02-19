/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

/**
 * Loan note entity (with creator name for display).
 */
export interface LoanNote {
  id: string;
  content: string;
  createdAt: Date;
  loanId: string;
  createdBy: string; // User display name
}
