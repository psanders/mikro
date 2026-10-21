/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * A loan renewal as a process (openspec add-loan-renewal):
 *
 *   DRAFT → CONTRACT_READY → SIGNED → COMPLETED
 *   exit: CANCELLED, from any status before COMPLETED
 *
 * Nothing touches the old loan, the new loan or the ledger until `finalize`.
 * `evaluateRenewalTransition` is pure — the server uses it to authorize every
 * renewal mutation and the dashboard uses it to enable or explain each button,
 * so the rules live in exactly one place (same idea as `evaluateTransition`
 * for applications).
 *
 * The amount the customer still owes on the old loan is NOT part of the stored
 * terms. It only decides how much leaves the account (net = principal − owed),
 * is recomputed at finalize, and must be re-confirmed by the user if it moved.
 */
import { z } from "zod/v4";
import { safeOptionalDate } from "./dates.js";
import { paymentFrequencyEnum } from "./loan.js";
import { customerDocumentTypeEnum } from "./customerDocument.js";
import { MAX_ATTACHMENT_SIZE_BYTES } from "./accounting.js";
import type { roleEnum } from "./user.js";

type Role = z.infer<typeof roleEnum>;

export const loanRenewalStatusEnum = z.enum([
  "DRAFT",
  "CONTRACT_READY",
  "SIGNED",
  "COMPLETED",
  "CANCELLED"
]);
export type LoanRenewalStatus = z.infer<typeof loanRenewalStatusEnum>;

/** Statuses in which the renewal is still in progress (one per loan at a time). */
export const OPEN_RENEWAL_STATUSES = ["DRAFT", "CONTRACT_READY", "SIGNED"] as const;

export function isOpenRenewalStatus(status: LoanRenewalStatus): boolean {
  return (OPEN_RENEWAL_STATUSES as readonly string[]).includes(status);
}

export const RENEWAL_STATUS_LABELS_ES: Record<LoanRenewalStatus, string> = {
  DRAFT: "Borrador",
  CONTRACT_READY: "Contrato listo",
  SIGNED: "Lista para finalizar",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada"
};

export const RENEWAL_STATUS_LABELS_EN: Record<LoanRenewalStatus, string> = {
  DRAFT: "Draft",
  CONTRACT_READY: "Contract ready",
  SIGNED: "Ready to finalize",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled"
};

export const RENEWAL_ACTIONS = [
  "updateTerms",
  "generateContract",
  "uploadSignedContract",
  "uploadDocument",
  "cancel",
  "finalize"
] as const;
export type RenewalAction = (typeof RENEWAL_ACTIONS)[number];

/** Why a transition is not allowed right now. */
export type RenewalTransitionBlock =
  | "NOT_ALLOWED" // caller is neither admin nor reviewer
  | "WRONG_STATUS" // the renewal is not in a source status of the action
  | "CONTRACT_REQUIRED" // a signed contract needs a generated contract first
  | "OLD_LOAN_NOT_ACTIVE" // the loan being renewed was closed meanwhile
  | "NET_NOT_POSITIVE" // the new principal does not cover what is owed
  | "CONFIRMATION_REQUIRED" // finalize without the net the user confirmed
  | "NET_CHANGED"; // what is owed moved since the user last saw the net

export const RENEWAL_BLOCK_LABELS_ES: Record<RenewalTransitionBlock, string> = {
  NOT_ALLOWED: "Tu rol no permite esta acción",
  WRONG_STATUS: "No aplica en el estado actual de la renovación",
  CONTRACT_REQUIRED: "Primero genera el contrato",
  OLD_LOAN_NOT_ACTIVE: "El préstamo a renovar ya no está activo",
  NET_NOT_POSITIVE: "El préstamo nuevo no cubre lo que se debe",
  CONFIRMATION_REQUIRED: "Confirma el monto a desembolsar",
  NET_CHANGED: "El monto a desembolsar cambió: confírmalo de nuevo"
};

export const RENEWAL_BLOCK_LABELS_EN: Record<RenewalTransitionBlock, string> = {
  NOT_ALLOWED: "Your role does not allow this action",
  WRONG_STATUS: "Not applicable in the renewal's current status",
  CONTRACT_REQUIRED: "Generate the contract first",
  OLD_LOAN_NOT_ACTIVE: "The loan being renewed is no longer active",
  NET_NOT_POSITIVE: "The new loan does not cover what is owed",
  CONFIRMATION_REQUIRED: "Confirm the amount to disburse",
  NET_CHANGED: "The amount to disburse changed: confirm it again"
};

/**
 * Blocks caused only by what the caller typed (or has yet to confirm). The UI
 * ignores these when deciding whether a button is enabled — "Finalizar" is
 * clickable before the amount is confirmed — and enforces them on submit.
 */
const INPUT_BLOCKS: ReadonlySet<RenewalTransitionBlock> = new Set<RenewalTransitionBlock>([
  "CONFIRMATION_REQUIRED",
  "NET_CHANGED"
]);

/** How the server should report a block over tRPC. */
export function renewalBlockCode(
  block: RenewalTransitionBlock
): "FORBIDDEN" | "CONFLICT" | "BAD_REQUEST" {
  if (block === "NOT_ALLOWED") return "FORBIDDEN";
  if (block === "NET_NOT_POSITIVE" || block === "CONFIRMATION_REQUIRED") return "BAD_REQUEST";
  return "CONFLICT";
}

/** The slice of a renewal the rules read. */
export interface RenewalForTransition {
  status: LoanRenewalStatus;
  contractFilename: string | null;
}

export interface RenewalActor {
  id: string;
  roles: readonly Role[];
}

export interface RenewalTransitionInput {
  /**
   * updateTerms: the proposed new principal. finalize: the renewal's stored
   * principal. Checked against what is owed (`ctx.owed`).
   */
  principal?: number | null;
  /** finalize: the net the caller confirmed (what the user saw and accepted). */
  confirmedNet?: number | null;
}

export interface RenewalTransitionContext {
  /** What the customer owes on the old loan right now (remaining balance + mora). */
  owed?: number;
  /** Whether the old loan is still ACTIVE. */
  oldLoanActive?: boolean;
}

export interface RenewalEvaluateOptions {
  /** Skip blocks that depend only on caller input (see INPUT_BLOCKS). */
  ignoreInput?: boolean;
}

export type RenewalTransitionResult =
  | { ok: true; to: LoanRenewalStatus }
  | { ok: false; reason: RenewalTransitionBlock };

const isReviewerOrAdmin = (a: RenewalActor) =>
  a.roles.includes("REVIEWER") || a.roles.includes("ADMIN");

/** Money compares at cents, like the ledger. */
export const roundMoney = (n: number): number => Math.round(n * 100) / 100;

/** Net to disburse: new principal − what is still owed on the old loan. */
export function renewalNet(principal: number, owed: number): number {
  return roundMoney(principal - owed);
}

/** Source statuses per action. */
export const RENEWAL_ACTION_SOURCE_STATUSES: Record<RenewalAction, readonly LoanRenewalStatus[]> = {
  updateTerms: ["DRAFT", "CONTRACT_READY", "SIGNED"],
  // Regenerating from CONTRACT_READY is fine; from SIGNED the terms must change first.
  generateContract: ["DRAFT", "CONTRACT_READY"],
  uploadSignedContract: ["CONTRACT_READY", "SIGNED"],
  uploadDocument: ["DRAFT", "CONTRACT_READY", "SIGNED"],
  cancel: ["DRAFT", "CONTRACT_READY", "SIGNED"],
  finalize: ["SIGNED"]
};

/**
 * Where an action leads. Terms changes invalidate the contract, so they always
 * return to DRAFT. A supporting document uploaded once the contract exists
 * makes the renewal ready to finalize (the signed copy or "additional
 * information" is what the user needs to attach before closing the deal).
 */
function targetOf(action: RenewalAction, from: LoanRenewalStatus): LoanRenewalStatus {
  switch (action) {
    case "updateTerms":
      return "DRAFT";
    case "generateContract":
      return "CONTRACT_READY";
    case "uploadSignedContract":
      return "SIGNED";
    case "uploadDocument":
      return from === "DRAFT" ? "DRAFT" : "SIGNED";
    case "cancel":
      return "CANCELLED";
    case "finalize":
      return "COMPLETED";
  }
}

type RuleCheck = (
  renewal: RenewalForTransition,
  input: RenewalTransitionInput,
  ctx: RenewalTransitionContext
) => RenewalTransitionBlock | null;

const covers = (principal: number | null | undefined, owed: number | undefined) =>
  principal == null || owed == null || renewalNet(principal, owed) > 0;

/** What must be true (state first, then input) for the action to go through. */
const REQUIRES: Record<RenewalAction, RuleCheck> = {
  updateTerms: (_r, input, ctx) => {
    if (ctx.oldLoanActive === false) return "OLD_LOAN_NOT_ACTIVE";
    return covers(input.principal, ctx.owed) ? null : "NET_NOT_POSITIVE";
  },
  generateContract: (_r, _input, ctx) =>
    ctx.oldLoanActive === false ? "OLD_LOAN_NOT_ACTIVE" : null,
  uploadSignedContract: (r) => (r.contractFilename ? null : "CONTRACT_REQUIRED"),
  uploadDocument: () => null,
  cancel: () => null,
  finalize: (_r, input, ctx) => {
    if (ctx.oldLoanActive === false) return "OLD_LOAN_NOT_ACTIVE";
    return input.confirmedNet == null ? "CONFIRMATION_REQUIRED" : null;
  }
};

/**
 * Decide whether `actor` may perform `action` on `renewal` right now.
 *
 * Checks run in a fixed order so the reason is the most useful one: wrong role
 * → NOT_ALLOWED; wrong source status → WRONG_STATUS; then state and input
 * requirements. For finalize, pass `ctx.owed` and `input.principal` (the
 * renewal's principal) and the recomputed net is compared with `confirmedNet`.
 */
export function evaluateRenewalTransition(
  renewal: RenewalForTransition,
  action: RenewalAction,
  actor: RenewalActor,
  input: RenewalTransitionInput = {},
  ctx: RenewalTransitionContext = {},
  options: RenewalEvaluateOptions = {}
): RenewalTransitionResult {
  if (!isReviewerOrAdmin(actor)) return { ok: false, reason: "NOT_ALLOWED" };
  if (!RENEWAL_ACTION_SOURCE_STATUSES[action].includes(renewal.status)) {
    return { ok: false, reason: "WRONG_STATUS" };
  }
  const req = REQUIRES[action](renewal, input, ctx);
  if (req && !(options.ignoreInput && INPUT_BLOCKS.has(req))) return { ok: false, reason: req };
  if (action === "finalize" && input.principal != null && ctx.owed != null) {
    const net = renewalNet(input.principal, ctx.owed);
    if (net <= 0) return { ok: false, reason: "NET_NOT_POSITIVE" };
    if (
      input.confirmedNet != null &&
      roundMoney(input.confirmedNet) !== net &&
      !(options.ignoreInput && INPUT_BLOCKS.has("NET_CHANGED"))
    ) {
      return { ok: false, reason: "NET_CHANGED" };
    }
  }
  return { ok: true, to: targetOf(action, renewal.status) };
}

// ---- inputs ----

const renewalId = { id: z.uuid({ error: "Invalid renewal ID" }) };

/** Proposed terms of the new loan. */
export const renewalTermsSchema = z.object({
  principal: z.number().positive("Principal must be positive"),
  termLength: z.number().int().positive("Term length must be a positive integer"),
  paymentAmount: z.number().positive("Payment amount must be positive"),
  paymentFrequency: paymentFrequencyEnum,
  startingDate: safeOptionalDate,
  nickname: z.string().max(100).optional(),
  moraRate: z.number().min(0).max(1, "moraRate must be between 0 and 1").optional()
});
export type RenewalTerms = z.infer<typeof renewalTermsSchema>;

/**
 * Start a renewal on an ACTIVE loan (by its human loan number). Any term left
 * out defaults to the old loan's own.
 */
export const startLoanRenewalSchema = z.object({
  loanId: z.number().int().positive("Loan ID must be a positive integer"),
  terms: renewalTermsSchema.partial().optional()
});

/** Change the proposed terms; invalidates the contract. At least one field. */
export const updateRenewalTermsSchema = z
  .object({ ...renewalId, terms: renewalTermsSchema.partial() })
  .refine((v) => Object.keys(v.terms).length > 0, {
    message: "Provide at least one term to change",
    path: ["terms"]
  });

export const getLoanRenewalSchema = z.object(renewalId);

/** Live quote for a renewal: what is owed on the old loan now and the net. */
export const getLoanRenewalQuoteSchema = z.object(renewalId);

/** Generate the new loan's contract from the renewal's stored terms. */
export const generateRenewalContractSchema = z.object({
  ...renewalId,
  maritalStatus: z.string().trim().max(40).optional(),
  occupation: z.string().trim().max(80).optional()
});

const renewalDocumentMimeType = z.enum(
  ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  { error: "File must be a JPEG, PNG, WebP, or PDF" }
);

const base64Contents = z
  .string()
  .min(1, "File content is required")
  .refine((b) => Math.ceil((b.length * 3) / 4) <= MAX_ATTACHMENT_SIZE_BYTES, {
    message: "File exceeds the maximum allowed size"
  });

/** Attach the signed contract (PDF only) to a renewal. */
export const uploadRenewalSignedContractSchema = z.object({
  ...renewalId,
  originalName: z.string().min(1).max(255),
  mimeType: z.literal("application/pdf", { error: "The signed contract must be a PDF" }),
  /** Base64-encoded contents (no data: prefix). */
  dataBase64: base64Contents
});

/** Attach a supporting document (image or PDF) to a renewal. */
export const uploadRenewalDocumentSchema = z.object({
  ...renewalId,
  type: customerDocumentTypeEnum.default("OTHER"),
  originalName: z.string().min(1).max(255),
  mimeType: renewalDocumentMimeType,
  dataBase64: base64Contents
});

export const cancelLoanRenewalSchema = z.object({
  ...renewalId,
  reason: z.string().trim().max(500).optional()
});

/**
 * Finalize: close the old loan, create the new one and post the net. The caller
 * sends the `confirmedNet` it showed the user; if the recomputed net differs
 * the request fails with NET_CHANGED and nothing is written.
 */
export const finalizeLoanRenewalSchema = z.object({
  ...renewalId,
  confirmedNet: z.number().positive("The amount to disburse must be positive"),
  /** Account the net leaves from. Defaults to `accounting.disbursementAccountId`. */
  accountId: z.uuid({ error: "Invalid account ID" }).optional()
});

/** The open renewal of a loan (by its human loan number), if any. */
export const getOpenLoanRenewalSchema = z.object({
  loanId: z.number().int().positive("Loan ID must be a positive integer")
});

export const listOpenLoanRenewalsSchema = z.object({
  limit: z.number().int().positive().max(100).optional()
});

export const listLoanRenewalsByCustomerSchema = z.object({
  customerId: z.uuid({ error: "Invalid customer ID" })
});

export type StartLoanRenewalInput = z.infer<typeof startLoanRenewalSchema>;
export type UpdateRenewalTermsInput = z.infer<typeof updateRenewalTermsSchema>;
export type GetLoanRenewalInput = z.infer<typeof getLoanRenewalSchema>;
export type GetLoanRenewalQuoteInput = z.infer<typeof getLoanRenewalQuoteSchema>;
export type GenerateRenewalContractInput = z.infer<typeof generateRenewalContractSchema>;
export type UploadRenewalSignedContractInput = z.infer<typeof uploadRenewalSignedContractSchema>;
export type UploadRenewalDocumentInput = z.infer<typeof uploadRenewalDocumentSchema>;
export type CancelLoanRenewalInput = z.infer<typeof cancelLoanRenewalSchema>;
export type FinalizeLoanRenewalInput = z.infer<typeof finalizeLoanRenewalSchema>;
export type GetOpenLoanRenewalInput = z.infer<typeof getOpenLoanRenewalSchema>;
export type ListOpenLoanRenewalsInput = z.infer<typeof listOpenLoanRenewalsSchema>;
export type ListLoanRenewalsByCustomerInput = z.infer<typeof listLoanRenewalsByCustomerSchema>;
