/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

export type ApplicationStatus =
  | "DRAFT"
  | "RECEIVED"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "SIGNED"
  | "CONVERTED"
  | "ABANDONED";

/**
 * Loan application (solicitud) entity type — a public form submission stored on
 * a stable schema. `rawData` holds the full normalized payload.
 */
export interface LoanApplication {
  id: string;
  sessionId: string;
  status: ApplicationStatus;
  lastSection: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  idNumber: string | null;
  dateOfBirth: Date | null;
  maritalStatus: string | null;
  businessType: string | null;
  businessName: string | null;
  requestedAmount: number | null;
  purpose: string | null;
  requestedTermWeeks: number | null;
  province: string | null;
  homeAddress: string | null;
  rawData: unknown;
  scoreData: unknown;
  score: number | null;
  riskBand: string | null;
  recommendation: string | null;
  scoredAt: Date | null;
  reviewedById: string | null;
  reviewedAt: Date | null;
  reviewNote: string | null;
  contractFilename: string | null;
  contractOriginalName: string | null;
  contractMimeType: string | null;
  contractSize: number | null;
  contractSha256: string | null;
  signedById: string | null;
  signedAt: Date | null;
  idFrontFilename: string | null;
  idFrontOriginalName: string | null;
  idFrontMimeType: string | null;
  idFrontSize: number | null;
  idBackFilename: string | null;
  idBackOriginalName: string | null;
  idBackMimeType: string | null;
  idBackSize: number | null;
  idUploadedById: string | null;
  idUploadedAt: Date | null;
  customerId: string | null;
  loanId: number | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
