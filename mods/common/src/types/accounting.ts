/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type {
  AccountKind,
  CategoryKind,
  TransactionStatus,
  TransactionType
} from "../schemas/accounting.js";

export interface AccountingAccount {
  id: string;
  name: string;
  kind: AccountKind;
  currency: string;
  openingBalance: number;
  currentBalance: number;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountingCategory {
  id: string;
  name: string;
  kind: CategoryKind;
  createdAt: Date;
}

export interface AccountingTransactionAttachment {
  id: string;
  filename: string;
  originalName: string | null;
  mimeType: string;
  size: number;
  sha256: string;
  transactionId: string;
  createdAt: Date;
}

export interface AccountingTransaction {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  occurredAt: Date;
  description: string | null;
  vendor: string | null;
  reference: string | null;
  reversalOfId: string | null;
  accountId: string;
  toAccountId: string | null;
  categoryId: string | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

/** Transaction enriched with display info (account name, category name, attachment count). */
export interface AccountingTransactionWithRelations extends AccountingTransaction {
  account: { id: string; name: string };
  toAccount: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  attachmentCount: number;
}

/** Attachment returned to clients (base64-encoded file contents). */
export interface AccountingTransactionAttachmentPayload {
  id: string;
  filename: string;
  originalName: string | null;
  mimeType: string;
  size: number;
  dataBase64: string;
}
