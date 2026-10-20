/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Documents uploaded straight onto a customer from the profile panel. Files
 * live in the contracts directory, content-addressed by sha256 (PDFs and images
 * share it), so an identical upload dedupes and a document migrated from an
 * application can point at the same file.
 */
import {
  ValidationError,
  deleteCustomerDocumentSchema,
  getCustomerDocumentSchema,
  uploadCustomerDocumentSchema,
  type CustomerDocument,
  type DeleteCustomerDocumentInput,
  type GetCustomerDocumentInput,
  type UploadCustomerDocumentInput
} from "@mikro/common";
import { TRPCError } from "@trpc/server";
import { readContract, saveContract, saveImage } from "../../applications/storage.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

/** Store a file and record it on the customer (source DIRECT). */
export function createUploadCustomerDocument(client: PrismaClient) {
  return async (raw: UploadCustomerDocumentInput, actorId: string): Promise<CustomerDocument> => {
    const parsed = uploadCustomerDocumentSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(parsed.error);
    const input = parsed.data;

    const customer = await client.customer.findUnique({
      where: { id: input.customerId },
      select: { id: true }
    });
    if (!customer) throw new TRPCError({ code: "NOT_FOUND", message: "El cliente no existe." });

    const saved =
      input.mimeType === "application/pdf"
        ? saveContract({ dataBase64: input.dataBase64 })
        : saveImage({ dataBase64: input.dataBase64, mimeType: input.mimeType });

    return (await client.customerDocument.create({
      data: {
        type: input.type,
        filename: saved.filename,
        originalName: input.originalName,
        mimeType: input.mimeType,
        size: saved.size,
        sha256: saved.sha256,
        source: "DIRECT",
        customerId: input.customerId,
        uploadedById: actorId
      }
    })) as unknown as CustomerDocument;
  };
}

export interface CustomerDocumentFile {
  id: string;
  type: string;
  originalName: string | null;
  mimeType: string | null;
  dataBase64: string;
}

/** The bytes of one document, for preview or download. */
export function createGetCustomerDocument(client: PrismaClient) {
  return async (raw: GetCustomerDocumentInput): Promise<CustomerDocumentFile> => {
    const parsed = getCustomerDocumentSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(parsed.error);
    const doc = await client.customerDocument.findUnique({ where: { id: parsed.data.id } });
    if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "El documento no existe." });
    let dataBase64: string;
    try {
      dataBase64 = readContract(doc.filename).dataBase64;
    } catch {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "El archivo del documento no está disponible."
      });
    }
    return {
      id: doc.id,
      type: doc.type,
      originalName: doc.originalName,
      mimeType: doc.mimeType,
      dataBase64
    };
  };
}

/**
 * Remove a document record. The file stays on disk: it is content-addressed and
 * may be shared with an application or another document (copy-by-reference), so
 * deleting it here could break those.
 */
export function createDeleteCustomerDocument(client: PrismaClient) {
  return async (raw: DeleteCustomerDocumentInput): Promise<{ id: string }> => {
    const parsed = deleteCustomerDocumentSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(parsed.error);
    const { count } = await client.customerDocument.deleteMany({ where: { id: parsed.data.id } });
    if (count === 0) throw new TRPCError({ code: "NOT_FOUND", message: "El documento no existe." });
    return { id: parsed.data.id };
  };
}
