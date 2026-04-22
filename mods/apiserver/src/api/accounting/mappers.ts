/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Mapping helpers from Prisma rows to the shared @mikro/common entity types.
 */
import type {
  AccountingAccount,
  AccountingCategory,
  AccountingTransaction,
  AccountingTransactionAttachment,
  AccountingTransactionWithRelations
} from "@mikro/common";

type PrismaAccount = {
  id: string;
  name: string;
  kind: "BANK" | "CASH" | "CREDIT_CARD" | "OTHER";
  currency: string;
  openingBalance: unknown;
  currentBalance: unknown;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PrismaCategory = {
  id: string;
  name: string;
  kind: "EXPENSE" | "INCOME";
  createdAt: Date;
};

type PrismaTransactionBase = {
  id: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "EXPENSE" | "INCOME" | "TRANSFER";
  status: "POSTED" | "REVERSED";
  amount: unknown;
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
};

type PrismaTransactionWithRelations = PrismaTransactionBase & {
  account: { id: string; name: string };
  toAccount: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  _count?: { attachments: number };
};

type PrismaAttachment = {
  id: string;
  filename: string;
  originalName: string | null;
  mimeType: string;
  size: number;
  sha256: string;
  transactionId: string;
  createdAt: Date;
};

const toNumber = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  if (
    v &&
    typeof v === "object" &&
    "toNumber" in v &&
    typeof (v as { toNumber: () => number }).toNumber === "function"
  ) {
    return (v as { toNumber: () => number }).toNumber();
  }
  return Number(v);
};

export function toAccount(row: PrismaAccount): AccountingAccount {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    currency: row.currency,
    openingBalance: toNumber(row.openingBalance),
    currentBalance: toNumber(row.currentBalance),
    isActive: row.isActive,
    notes: row.notes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function toCategory(row: PrismaCategory): AccountingCategory {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    createdAt: row.createdAt
  };
}

export function toTransaction(row: PrismaTransactionBase): AccountingTransaction {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    amount: toNumber(row.amount),
    occurredAt: row.occurredAt,
    description: row.description,
    vendor: row.vendor,
    reference: row.reference,
    reversalOfId: row.reversalOfId,
    accountId: row.accountId,
    toAccountId: row.toAccountId,
    categoryId: row.categoryId,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function toTransactionWithRelations(
  row: PrismaTransactionWithRelations
): AccountingTransactionWithRelations {
  return {
    ...toTransaction(row),
    account: { id: row.account.id, name: row.account.name },
    toAccount: row.toAccount ? { id: row.toAccount.id, name: row.toAccount.name } : null,
    category: row.category ? { id: row.category.id, name: row.category.name } : null,
    createdBy: { id: row.createdBy.id, name: row.createdBy.name },
    attachmentCount: row._count?.attachments ?? 0
  };
}

export function toAttachment(row: PrismaAttachment): AccountingTransactionAttachment {
  return {
    id: row.id,
    filename: row.filename,
    originalName: row.originalName,
    mimeType: row.mimeType,
    size: row.size,
    sha256: row.sha256,
    transactionId: row.transactionId,
    createdAt: row.createdAt
  };
}
