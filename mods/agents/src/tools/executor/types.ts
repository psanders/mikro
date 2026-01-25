/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Types for the tool executor.
 */

/**
 * API functions required by the tool executor.
 */
export interface ToolExecutorDependencies {
  /** Create a new member */
  createMember: (params: {
    name: string;
    phone: string;
    idNumber: string;
    collectionPoint: string;
    homeAddress: string;
    referredById: string;
    assignedCollectorId?: string;
    jobPosition?: string;
    income?: number;
    isBusinessOwner?: boolean;
  }) => Promise<{ id: string; name: string; phone: string }>;

  /** List users with optional role filter */
  listUsers: (params?: { role?: "ADMIN" | "COLLECTOR" | "REFERRER" }) => Promise<
    Array<{
      id: string;
      name: string;
      phone: string;
      roles?: Array<{ role: string }>;
    }>
  >;

  /** Create a payment */
  createPayment: (params: {
    loanId: number; // Numeric loanId - function converts to UUID internally
    amount: number;
    collectedById?: string;
    notes?: string;
  }) => Promise<{ id: string; amount: number }>;

  /** Generate a receipt */
  generateReceipt: (params: { paymentId: string }) => Promise<{ image: string; token: string }>;

  /** Send receipt via WhatsApp */
  sendReceiptViaWhatsApp: (params: { paymentId: string; phone: string }) => Promise<{
    success: boolean;
    message: string;
    messageId?: string;
    imageUrl?: string;
    error?: string;
  }>;

  /** List loans by collector */
  listLoansByCollector: (params: {
    assignedCollectorId: string;
    showAll?: boolean;
  }) => Promise<Array<{ id: string; loanId: number; principal: number; status: string }>>;

  /** Get member by ID */
  getMember: (params: {
    id: string;
  }) => Promise<{ id: string; name: string; phone: string } | null>;

  /** Create a loan */
  createLoan: (params: {
    memberId: string;
    principal: number;
    termLength: number;
    paymentAmount: number;
    paymentFrequency: "WEEKLY" | "DAILY";
  }) => Promise<{ id: string; loanId: number }>;

  /** Get member by phone number */
  getMemberByPhone: (params: {
    phone: string;
  }) => Promise<{ id: string; name: string; phone: string } | null>;

  /** List loans by member ID */
  listLoansByMember: (params: {
    memberId: string;
    showAll?: boolean;
  }) => Promise<Array<{ id: string; loanId: number; principal: number; status: string }>>;

  /** Get loan by numeric loan ID */
  getLoanByLoanId: (params: { loanId: number }) => Promise<{
    id: string; // UUID
    loanId: number; // Numeric loan ID
    principal: number;
    termLength: number;
    paymentAmount: number;
    paymentFrequency: string;
    status: string;
    member: {
      id: string;
      name: string;
      phone: string;
      assignedCollectorId: string | null; // Required for validation
    };
  } | null>;

  /** List payments by loan ID (numeric) */
  listPaymentsByLoanId: (params: { loanId: number; limit?: number }) => Promise<
    Array<{
      id: string; // Payment UUID
      amount: number;
      paidAt: Date;
      status: string;
      method: string;
    }>
  >;
}
