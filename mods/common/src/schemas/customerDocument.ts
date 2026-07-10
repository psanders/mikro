/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * A document belonging to a customer directly (not a loan application) —
 * signed contracts, cédula images, etc. `DIRECT` documents are
 * uploaded/generated against the customer directly (e.g.
 * generateCustomerContract); `MIGRATED_FROM_APPLICATION` documents are
 * copied, by reference, from a LoanApplication's own document columns at
 * conversion time (see createConvertApplication). Documents are immutable
 * once created.
 */
import { z } from "zod/v4";

export const customerDocumentTypeEnum = z.enum(["CONTRACT", "ID_FRONT", "ID_BACK", "OTHER"]);
export type CustomerDocumentType = z.infer<typeof customerDocumentTypeEnum>;

export const customerDocumentSourceEnum = z.enum(["DIRECT", "MIGRATED_FROM_APPLICATION"]);
export type CustomerDocumentSource = z.infer<typeof customerDocumentSourceEnum>;

/** Schema for listing a customer's documents, most-recent-first. */
export const listCustomerDocumentsSchema = z.object({
  customerId: z.uuid({ error: "Invalid customer ID" })
});
export type ListCustomerDocumentsInput = z.infer<typeof listCustomerDocumentsSchema>;
