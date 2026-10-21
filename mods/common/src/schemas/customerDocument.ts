/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * A document belonging to a customer directly (not a loan application) —
 * signed contracts, cédula images, etc. `DIRECT` documents are
 * uploaded/generated against the customer directly (e.g.
 * generateCustomerContract); `MIGRATED_FROM_APPLICATION` documents are
 * copied, by reference, from a LoanApplication's own document columns at
 * conversion time (see createConvertApplication). Documents are immutable
 * once created, except that an admin may delete one.
 */
import { z } from "zod/v4";
import { MAX_ATTACHMENT_SIZE_BYTES } from "./accounting.js";

export const customerDocumentTypeEnum = z.enum([
  "CONTRACT",
  "ID_FRONT",
  "ID_BACK",
  "BUSINESS_PHOTO",
  "OTHER"
]);
export type CustomerDocumentType = z.infer<typeof customerDocumentTypeEnum>;

export const customerDocumentSourceEnum = z.enum(["DIRECT", "MIGRATED_FROM_APPLICATION"]);
export type CustomerDocumentSource = z.infer<typeof customerDocumentSourceEnum>;

/** Schema for listing a customer's documents, most-recent-first. */
export const listCustomerDocumentsSchema = z.object({
  customerId: z.uuid({ error: "Invalid customer ID" })
});
export type ListCustomerDocumentsInput = z.infer<typeof listCustomerDocumentsSchema>;

const customerDocumentMimeType = z.enum(
  ["image/jpeg", "image/png", "image/webp", "application/pdf"],
  { error: "File must be a JPEG, PNG, WebP, or PDF" }
);

/** Upload a document straight onto a customer (profile panel). */
export const uploadCustomerDocumentSchema = z.object({
  customerId: z.uuid({ error: "Invalid customer ID" }),
  type: customerDocumentTypeEnum,
  originalName: z.string().min(1).max(255),
  mimeType: customerDocumentMimeType,
  /** Base64-encoded contents (no data: prefix). */
  dataBase64: z
    .string()
    .min(1, "File content is required")
    .refine((b) => Math.ceil((b.length * 3) / 4) <= MAX_ATTACHMENT_SIZE_BYTES, {
      message: "File exceeds the maximum allowed size"
    })
});
export type UploadCustomerDocumentInput = z.infer<typeof uploadCustomerDocumentSchema>;

/** Read one document's bytes (base64) for preview or download. */
export const getCustomerDocumentSchema = z.object({
  id: z.uuid({ error: "Invalid document ID" })
});
export type GetCustomerDocumentInput = z.infer<typeof getCustomerDocumentSchema>;

/** Delete one document (admin only). */
export const deleteCustomerDocumentSchema = z.object({
  id: z.uuid({ error: "Invalid document ID" })
});
export type DeleteCustomerDocumentInput = z.infer<typeof deleteCustomerDocumentSchema>;
