/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */

export type ApplicationStatus =
  | "DRAFT"
  | "RECEIVED"
  | "IN_REVIEW"
  | "PENDING_DECISION"
  | "APPROVED"
  | "CONVERTED"
  | "REJECTED"
  | "ABANDONED";

export type ApplicationRejectionReason =
  | "OUT_OF_COVERAGE_AREA"
  | "PAYMENT_CAPACITY"
  | "DOCUMENTS"
  | "OTHER";

export type ApplicationDocumentKind = "BUSINESS_PHOTO" | "OTHER";

export type ApplicationSource = "FORM" | "WHATSAPP" | "MANUAL";

/**
 * Loan application (solicitud) entity type — a public form submission stored on
 * a stable schema. `rawData` holds the full normalized payload.
 */
export interface LoanApplication {
  id: string;
  sessionId: string;
  status: ApplicationStatus;
  source: ApplicationSource;
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
  assignedReviewerId: string | null;
  assignedAt: Date | null;
  reviewerRecommendation: string | null;
  sentToDecisionAt: Date | null;
  decidedById: string | null;
  decidedAt: Date | null;
  decisionNote: string | null;
  rejectionReason: ApplicationRejectionReason | null;
  approvedAmount: number | null;
  approvedTermWeeks: number | null;
  contractTerms: unknown;
  aiSummary: string | null;
  aiSummaryAt: Date | null;
  contractFilename: string | null;
  contractOriginalName: string | null;
  contractMimeType: string | null;
  contractSize: number | null;
  contractSha256: string | null;
  signedById: string | null;
  signedAt: Date | null;
  /** Business location evidence: a Google Maps link only. */
  mapUrl: string | null;
  /** When the evidence last became complete (the completion-event claim). */
  evidenceCompletedAt: Date | null;
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
  adId: string | null;
  adsetId: string | null;
  campaignId: string | null;
  customerId: string | null;
  loanId: number | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Evidence file on an application (business photo or other document). */
export interface ApplicationDocument {
  id: string;
  applicationId: string;
  kind: ApplicationDocumentKind;
  label: string | null;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  sha256: string;
  uploadedById: string;
  createdAt: Date;
}

/**
 * One Meta ad we have seen produce at least one application, with the names it
 * carried at click time. Learned from the forwarded URL parameters — never from
 * a live Meta call — so reports render names offline and keep working after the
 * ad is deleted in Ads Manager.
 */
export interface MetaAd {
  id: string;
  name: string | null;
  adsetId: string | null;
  adsetName: string | null;
  campaignId: string | null;
  campaignName: string | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
}
