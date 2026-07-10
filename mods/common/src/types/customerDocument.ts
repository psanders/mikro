/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { CustomerDocumentType, CustomerDocumentSource } from "../schemas/customerDocument.js";

/**
 * A document belonging to a customer directly. Bytes live on disk under
 * contractsPath as `<sha256>.<ext>`; this is metadata only. See
 * `customerDocumentTypeEnum`/`customerDocumentSourceEnum` for the meaning of
 * `type`/`source`.
 */
export interface CustomerDocument {
  id: string;
  type: CustomerDocumentType;
  filename: string;
  originalName?: string | null;
  mimeType?: string | null;
  size?: number | null;
  sha256: string;
  source: CustomerDocumentSource;
  customerId: string;
  uploadedById?: string | null;
  createdAt: Date;
}
