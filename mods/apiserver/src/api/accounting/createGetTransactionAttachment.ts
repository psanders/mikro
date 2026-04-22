/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  getTransactionAttachmentSchema,
  type GetTransactionAttachmentInput,
  type AccountingTransactionAttachmentPayload
} from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { readTransactionAttachment } from "../../accounting/storage.js";

export function createGetTransactionAttachment(client: PrismaClient) {
  const fn = async (
    params: GetTransactionAttachmentInput
  ): Promise<AccountingTransactionAttachmentPayload> => {
    const attachment = await client.accountingTransactionAttachment.findUnique({
      where: { id: params.id }
    });
    if (!attachment) throw new Error(`Attachment not found: ${params.id}`);
    const { dataBase64 } = readTransactionAttachment(attachment.filename);
    return {
      id: attachment.id,
      filename: attachment.filename,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      size: attachment.size,
      dataBase64
    };
  };
  return withErrorHandlingAndValidation(fn, getTransactionAttachmentSchema);
}
