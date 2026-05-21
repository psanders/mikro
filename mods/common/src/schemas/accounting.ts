/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";
import { safeRequiredDate } from "./dates.js";

export const accountKindEnum = z.enum(["BANK", "CASH", "CREDIT_CARD", "OTHER"]);
export type AccountKind = z.infer<typeof accountKindEnum>;

export const transactionTypeEnum = z.enum([
  "DEPOSIT",
  "WITHDRAWAL",
  "EXPENSE",
  "INCOME",
  "TRANSFER"
]);
export type TransactionType = z.infer<typeof transactionTypeEnum>;

export const transactionStatusEnum = z.enum(["POSTED", "REVERSED"]);
export type TransactionStatus = z.infer<typeof transactionStatusEnum>;

export const categoryKindEnum = z.enum(["EXPENSE", "INCOME"]);
export type CategoryKind = z.infer<typeof categoryKindEnum>;

/**
 * Attachment types allowed for transaction receipts. Keep it small and safe.
 */
export const allowedAttachmentMimeTypes = ["image/png", "image/jpeg", "application/pdf"] as const;
export const attachmentMimeTypeEnum = z.enum(allowedAttachmentMimeTypes);

/** Max attachment size in bytes (10 MB). */
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

/** Max number of attachments per transaction. */
export const MAX_ATTACHMENTS_PER_TRANSACTION = 10;

/**
 * Upper bound on the JSON body size for the tRPC endpoint, derived from the
 * accounting attachment limits so that server and schema stay consistent.
 *
 * Formula: up to MAX_ATTACHMENTS_PER_TRANSACTION × MAX_ATTACHMENT_SIZE_BYTES
 * raw bytes, expanded ~4/3 by base64, plus 64 KB of JSON envelope headroom.
 */
export const MAX_TRPC_REQUEST_BYTES =
  Math.ceil((MAX_ATTACHMENT_SIZE_BYTES * MAX_ATTACHMENTS_PER_TRANSACTION * 4) / 3) + 64 * 1024;

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------

export const createAccountSchema = z.object({
  name: z.string().min(1, "Account name is required").max(100),
  kind: accountKindEnum.optional(),
  currency: z.string().min(3).max(3).optional(),
  openingBalance: z.number().optional(),
  notes: z.string().max(500).optional()
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = z.object({
  id: z.uuid({ error: "Invalid account ID" }),
  name: z.string().min(1).max(100).optional(),
  kind: accountKindEnum.optional(),
  currency: z.string().min(3).max(3).optional(),
  isActive: z.boolean().optional(),
  notes: z.string().max(500).nullable().optional()
});
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;

export const listAccountsSchema = z.object({
  includeInactive: z.boolean().optional()
});
export type ListAccountsInput = z.infer<typeof listAccountsSchema>;

export const getAccountSchema = z.object({
  id: z.uuid({ error: "Invalid account ID" })
});
export type GetAccountInput = z.infer<typeof getAccountSchema>;

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const createCategorySchema = z.object({
  name: z.string().min(1, "Category name is required").max(100),
  kind: categoryKindEnum
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const listCategoriesSchema = z.object({
  kind: categoryKindEnum.optional()
});
export type ListCategoriesInput = z.infer<typeof listCategoriesSchema>;

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export const transactionAttachmentInputSchema = z.object({
  /** Original filename (optional, used for display). */
  originalName: z.string().max(255).optional(),
  /** MIME type — validated against the allow-list. */
  mimeType: attachmentMimeTypeEnum,
  /** Base64-encoded file contents (no data: prefix). */
  dataBase64: z.string().min(1, "Attachment content is required")
});
export type TransactionAttachmentInput = z.infer<typeof transactionAttachmentInputSchema>;

const transactionBaseShape = {
  type: transactionTypeEnum,
  accountId: z.uuid({ error: "Invalid account ID" }),
  toAccountId: z.uuid({ error: "Invalid destination account ID" }).optional(),
  amount: z.number().positive("Amount must be positive"),
  occurredAt: safeRequiredDate,
  description: z.string().max(500).optional(),
  vendor: z.string().max(200).optional(),
  reference: z.string().max(200).optional(),
  categoryId: z.uuid({ error: "Invalid category ID" }).optional(),
  attachments: z
    .array(transactionAttachmentInputSchema)
    .max(MAX_ATTACHMENTS_PER_TRANSACTION)
    .optional()
} as const;

/**
 * Applies cross-field refinements to a transaction-shaped schema. Shared
 * between the public (client-facing) schema and the internal one that also
 * carries `createdById` injected from the authenticated session.
 */
function withTransactionRefinements<
  T extends z.ZodObject<{
    type: typeof transactionTypeEnum;
    accountId: z.ZodType<string>;
    toAccountId: z.ZodType<string | undefined>;
    categoryId: z.ZodType<string | undefined>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [k: string]: any;
  }>
>(schema: T) {
  return schema
    .refine((v) => (v.type === "TRANSFER" ? !!v.toAccountId : true), {
      message: "toAccountId is required when type is TRANSFER",
      path: ["toAccountId"]
    })
    .refine((v) => (v.type === "TRANSFER" ? v.toAccountId !== v.accountId : true), {
      message: "toAccountId must be different from accountId",
      path: ["toAccountId"]
    })
    .refine((v) => (v.type !== "TRANSFER" ? !v.toAccountId : true), {
      message: "toAccountId is only allowed when type is TRANSFER",
      path: ["toAccountId"]
    })
    .refine((v) => (v.categoryId ? v.type === "EXPENSE" || v.type === "INCOME" : true), {
      message: "categoryId is only allowed for EXPENSE or INCOME transactions",
      path: ["categoryId"]
    });
}

/**
 * Public input schema for creating a transaction. `createdById` is NOT part
 * of this schema — the server injects the authenticated user's ID from the
 * session. See {@link createTransactionInternalSchema} for the internal
 * representation used by the API factory.
 */
export const createTransactionSchema = withTransactionRefinements(z.object(transactionBaseShape));
export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

/**
 * Internal schema used by the server-side `createCreateTransaction` factory,
 * which also expects `createdById` (taken from the authenticated session).
 */
export const createTransactionInternalSchema = withTransactionRefinements(
  z.object({
    ...transactionBaseShape,
    createdById: z.uuid({ error: "Creator user ID is required and must be a valid UUID" })
  })
);
export type CreateTransactionInternalInput = z.infer<typeof createTransactionInternalSchema>;

/**
 * Public input schema for reversing a transaction. `createdById` is NOT part
 * of this schema — the server injects the authenticated user's ID from the
 * session.
 */
export const reverseTransactionSchema = z.object({
  id: z.uuid({ error: "Invalid transaction ID" }),
  notes: z.string().max(500).optional()
});
export type ReverseTransactionInput = z.infer<typeof reverseTransactionSchema>;

/**
 * Internal schema used by the server-side `createReverseTransaction` factory.
 */
export const reverseTransactionInternalSchema = reverseTransactionSchema.extend({
  createdById: z.uuid({ error: "Creator user ID is required and must be a valid UUID" })
});
export type ReverseTransactionInternalInput = z.infer<typeof reverseTransactionInternalSchema>;

export const listTransactionsSchema = z.object({
  startDate: safeRequiredDate,
  endDate: safeRequiredDate,
  accountId: z.uuid().optional(),
  categoryId: z.uuid().optional(),
  type: transactionTypeEnum.optional(),
  includeReversed: z.boolean().optional(),
  limit: z.number().int().positive().max(500).optional(),
  offset: z.number().int().nonnegative().optional()
});
export type ListTransactionsInput = z.infer<typeof listTransactionsSchema>;

export const getTransactionSchema = z.object({
  id: z.uuid({ error: "Invalid transaction ID" })
});
export type GetTransactionInput = z.infer<typeof getTransactionSchema>;

export const getTransactionAttachmentSchema = z.object({
  id: z.uuid({ error: "Invalid attachment ID" })
});
export type GetTransactionAttachmentInput = z.infer<typeof getTransactionAttachmentSchema>;
