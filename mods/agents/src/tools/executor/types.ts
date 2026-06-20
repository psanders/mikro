/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Types for the tool executor.
 */

/**
 * Loan data for customer export reports.
 */
export interface ExportedLoan {
  loanId: number;
  notes: string | null;
  paymentFrequency: string;
  createdAt: Date;
  termLength: number;
  payments: Array<{ paidAt: Date }>;
  nickname?: string | null;
}

/**
 * Customer data for export reports. Used by all export functions.
 */
export interface ExportedCustomer {
  name: string;
  /** Customer-level nickname (included in agent export payloads for reports). */
  nickname?: string | null;
  phone: string;
  collectionPoint: string | null;
  notes: string | null;
  preferredPaymentDay?: string | null;
  loans: ExportedLoan[];
}

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
    assignedCollectorId?: string;
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

  /** Get customer by phone number */
  getCustomerByPhone: (params: {
    phone: string;
  }) => Promise<{ id: string; name: string; phone: string } | null>;

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

  /** Export collector customers with loans and referrer for report generation */
  exportCollectorCustomers: (params: {
    assignedCollectorId: string;
  }) => Promise<ExportedCustomer[]>;

  /** Export all customers with loans for report generation (admin only) */
  exportAllCustomers: () => Promise<ExportedCustomer[]>;

  /** Generate performance report (metrics + LLM narrative + PNG). Returns base64 image. */
  generatePerformanceReport: (params: {
    startDate?: string;
    endDate?: string;
  }) => Promise<{ image: string }>;

  /** Generate at-risk loans report (defaulted + late, PNG with AI note summaries). Optional filter. Returns base64 image. */
  generateDefaultedReport: (params: { filter?: "all" | "defaulted" | "late" }) => Promise<{
    image: string;
  }>;

  /** Generate renewal candidates report (near-completion + completed loans, rating, AI candidacy note). Returns base64 image. */
  generateRenewalCandidatesReport: (params: Record<string, never>) => Promise<{ image: string }>;

  /** Render customers report (grouped by payment health) to PNG buffer. Used for simplified format. */
  renderCustomersReportToPng: (customers: ExportedCustomer[]) => Promise<Buffer>;

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

  /** Upload media to WhatsApp and get media ID */
  uploadMedia: (fileBuffer: Buffer, mimeType: string) => Promise<string>;

  /** Send a WhatsApp message (text, image, or document) */
  sendWhatsAppMessage: (params: {
    phone: string;
    message?: string;
    mediaId?: string;
    mediaType?: "image" | "document" | "video" | "audio";
    documentFilename?: string;
    caption?: string;
  }) => Promise<{
    messages?: Array<{ id: string }>;
  }>;
}
