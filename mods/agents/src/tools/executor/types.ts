/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Types for the tool executor.
 */

/**
 * API functions required by the tool executor.
 */
export interface ToolExecutorDependencies {
  /** Create a new customer */
  createCustomer: (params: {
    name: string;
    phone: string;
    idNumber: string;
    collectionPoint?: string;
    homeAddress: string;
    assignedCollectorId: string;
    jobPosition?: string;
    income?: number;
    isBusinessOwner?: boolean;
    preferredPaymentDay?: string;
  }) => Promise<{ id: string; name: string; phone: string }>;

  /** List users with optional role filter */
  listUsers: (params?: { role?: "ADMIN" | "COLLECTOR" | "REVIEWER" }) => Promise<
    Array<{
      id: string;
      name: string;
      phone: string;
      roles?: Array<{ role: string }>;
    }>
  >;

  /** Create a payment (may split into INSTALLMENT + LATE_FEE rows). */
  createPayment: (params: {
    loanId: number;
    amount: number;
    collectedById: string;
    notes?: string;
    kind?: "INSTALLMENT" | "LATE_FEE";
    lateFeeOverride?: number;
    status?: "COMPLETED" | "PARTIAL";
  }) => Promise<{
    installment: { id: string; amount: number } | null;
    lateFee: { id: string; amount: number } | null;
  }>;

  /** Generate a receipt */
  generateReceipt: (params: { paymentId: string }) => Promise<{ image: string; token: string }>;

  /** Send receipt via WhatsApp */
  sendReceiptViaWhatsApp: (params: { paymentId: string; phone: string }) => Promise<{
    success: boolean;
    message: string;
    messageId?: string;
    error?: string;
  }>;

  /** List loans by collector */
  listLoansByCollector: (params: {
    assignedCollectorId: string;
    showAll?: boolean;
  }) => Promise<Array<{ id: string; loanId: number; principal: number; status: string }>>;

  /** Get customer by ID */
  getCustomer: (params: {
    id: string;
  }) => Promise<{ id: string; name: string; phone: string } | null>;

  /** Create a loan */
  createLoan: (params: {
    customerId: string;
    principal: number;
    termLength: number;
    paymentAmount: number;
    paymentFrequency: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
    startingDate?: Date;
  }) => Promise<{ id: string; loanId: number }>;

  /** Calculate loan options from base duration and interest */
  calculateLoan: (params: {
    principal: number;
    interestRate: number;
    paymentFrequency: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
    baseDuration: number;
    adjustmentPerPeriod?: number;
  }) => Promise<{
    principal: number;
    paymentFrequency: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
    baseDuration: number;
    baseInterestRate: number;
    adjustmentPerPeriod: number;
    minRate: number;
    maxRate: number;
    options: Array<{
      duration: number;
      paymentFrequency: "WEEKLY" | "DAILY";
      interestRate: number;
      totalInterest: number;
      totalRepay: number;
      paymentPerPeriod: number;
      isBase: boolean;
    }>;
  }>;

  /** Update a loan's status to COMPLETED, DEFAULTED, or CANCELLED */
  updateLoanStatus: (params: {
    loanId: number;
    status: "COMPLETED" | "DEFAULTED" | "CANCELLED";
  }) => Promise<{ id: string; loanId: number; status: string }>;

  /**
   * Send the approved promo template to a phone, no application created.
   * Best-effort: a bad phone or WhatsApp error resolves to `{ sent: false, error }`
   * rather than throwing.
   */
  sendPromo: (params: {
    phone: string;
  }) => Promise<{ sent: boolean; messageId?: string; error?: string }>;

  /** Get customer by phone number */
  getCustomerByPhone: (params: {
    phone: string;
  }) => Promise<{ id: string; name: string; phone: string } | null>;

  /** Get a loan application (solicitud) by its id (UUID) */
  getApplication: (params: {
    id: string;
  }) => Promise<import("@mikro/common").LoanApplication | null>;

  // ── Application review write tools (optional — only wired in apiserver) ────
  /**
   * Approve a solicitud (RECEIVED/IN_REVIEW -> APPROVED). `reviewerId` is the
   * confirming founder. Copilot-only; the WhatsApp agent executor leaves it unset.
   */
  approveApplication?: (
    input: { id?: string; sessionId?: string; note?: string },
    reviewerId: string
  ) => Promise<import("@mikro/common").LoanApplication>;
  /**
   * Reject a solicitud (RECEIVED/IN_REVIEW -> REJECTED). The required `reason` is
   * persisted as the review note for audit. `reviewerId` is the confirming founder.
   */
  rejectApplication?: (
    input: { id?: string; sessionId?: string; reason: string },
    reviewerId: string
  ) => Promise<import("@mikro/common").LoanApplication>;
  /**
   * Hard-delete (purge) a non-CONVERTED solicitud. Irreversible. `reviewerId` is
   * the confirming founder.
   */
  deleteApplication?: (
    input: { id?: string; sessionId?: string },
    reviewerId: string
  ) => Promise<import("@mikro/common").LoanApplication>;

  // ── QCobro on-demand sync (optional — only wired in apiserver) ───────────
  /**
   * Force a full-base QCobro portfolio sync on demand — the exact same pass
   * the cron worker and on-payment trigger already run (see
   * createSyncAllPortfolios.ts). Copilot-only, gated by the pending-action
   * confirm flow. `actorName` (the confirming founder) attributes the
   * `qcobro.synced` feed event this records.
   */
  forceQCobroSync?: (actorName?: string) => Promise<{
    customers: number;
    portfoliosPushed: number;
    portfoliosSkipped: number;
    durationMs: number;
  }>;

  // ── Founder copilot accounting write tool (optional — only wired in apiserver) ──
  /**
   * Create an accounting transaction (income/expense/transfer). Copilot-only,
   * gated by the pending-action confirm flow (mikro/#115). `account`,
   * `toAccount`, and `category` may be a name or a UUID — the apiserver
   * wiring resolves names to ids before calling the accounting API.
   * `createdById` is the confirming founder.
   */
  createAccountingTransaction?: (
    params: {
      type: "DEPOSIT" | "WITHDRAWAL" | "EXPENSE" | "INCOME" | "TRANSFER";
      account: string;
      toAccount?: string;
      amount: number;
      category?: string;
      description?: string;
      vendor?: string;
      reference?: string;
      occurredAt?: Date;
    },
    createdById: string
  ) => Promise<{
    id: string;
    type: string;
    amount: number;
    account: string;
    toAccount: string | null;
    category: string | null;
  }>;

  /** List loans by customer ID */
  listLoansByCustomer: (params: {
    customerId: string;
    showAll?: boolean;
  }) => Promise<Array<{ id: string; loanId: number; principal: number; status: string }>>;

  /** Preview accrued mora for a loan (numeric loanId). */
  previewLateFee: (params: { loanId: number; asOf?: Date }) => Promise<{
    accruedMora: number;
    grossMora: number;
    collectedMora: number;
    daysLate: number;
    missedCycles: number;
    cuota: number;
    suggestedTotal: number;
    moraRate: number;
  }>;

  /** Get loan by numeric loan ID */
  getLoanByLoanId: (params: { loanId: number }) => Promise<{
    id: string; // UUID
    loanId: number; // Numeric loan ID
    principal: number;
    termLength: number;
    paymentAmount: number;
    paymentFrequency: string;
    status: string;
    nickname: string | null;
    customer: {
      id: string;
      name: string;
      nickname: string | null;
      phone: string;
      assignedCollectorId: string; // Always present; mikro/#41
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

  // ── José prospect intake tools (optional — only wired in apiserver) ──────
  /** José: fetch current prospect application state + score simulation */
  joseGetApplicationState?: (
    context?: Record<string, unknown>
  ) => Promise<import("../../llm/types.js").ToolResult>;
  /** José: save validated field answers to the prospect application */
  joseSaveAnswer?: (
    args: Record<string, unknown>,
    context?: Record<string, unknown>
  ) => Promise<import("../../llm/types.js").ToolResult>;
  /** José: finalize prospect application and send closing WhatsApp message */
  joseFinalizeApplication?: (
    args: Record<string, unknown>,
    context?: Record<string, unknown>
  ) => Promise<import("../../llm/types.js").ToolResult>;
}
