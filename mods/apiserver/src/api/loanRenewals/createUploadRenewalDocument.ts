/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  ValidationError,
  uploadRenewalDocumentSchema,
  uploadRenewalSignedContractSchema,
  type RenewalActor,
  type UploadRenewalDocumentInput,
  type UploadRenewalSignedContractInput
} from "@mikro/common";
import { TRPCError } from "@trpc/server";
import { saveContract, saveImage } from "../../applications/storage.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { decide, emitRenewalEvent, loadRenewal, viewOf, type LoanRenewalView } from "./support.js";

/**
 * Attach the signed contract (PDF) to a renewal. It must differ from the
 * generated contract (an unsigned copy is not a signed one), replaces any
 * earlier signed copy, and makes the renewal ready to finalize.
 */
export function createUploadRenewalSignedContract(client: PrismaClient) {
  return async (
    raw: UploadRenewalSignedContractInput,
    actor: RenewalActor
  ): Promise<LoanRenewalView> => {
    const parsed = uploadRenewalSignedContractSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(parsed.error);
    const input = parsed.data;

    const renewal = await loadRenewal(client, input.id);
    const to = decide(renewal, "uploadSignedContract", actor);
    const saved = saveContract({ dataBase64: input.dataBase64 });
    if (saved.filename === renewal.contractFilename) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Ese archivo es el contrato sin firmar. Sube la copia firmada."
      });
    }

    const updated = await client.$transaction(async (tx) => {
      const { count } = await tx.loanRenewal.updateMany({
        where: { id: renewal.id, status: renewal.status },
        data: { status: to, signedContractFilename: saved.filename }
      });
      if (count === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "La renovación cambió mientras subías el archivo; recarga e intenta de nuevo."
        });
      }
      if (renewal.signedContractFilename && renewal.signedContractFilename !== saved.filename) {
        await tx.customerDocument.deleteMany({
          where: { renewalId: renewal.id, filename: renewal.signedContractFilename }
        });
      }
      const already = await tx.customerDocument.findFirst({
        where: { renewalId: renewal.id, filename: saved.filename },
        select: { id: true }
      });
      if (!already) {
        await tx.customerDocument.create({
          data: {
            type: "CONTRACT",
            filename: saved.filename,
            originalName: input.originalName,
            mimeType: "application/pdf",
            size: saved.size,
            sha256: saved.sha256,
            source: "DIRECT",
            customerId: renewal.customerId,
            renewalId: renewal.id,
            uploadedById: actor.id
          }
        });
      }
      const r = await loadRenewal(tx, renewal.id);
      await emitRenewalEvent(
        tx,
        "loan.renewal.document_uploaded",
        actor,
        r,
        "subió el contrato firmado de la renovación",
        {
          kind: "SIGNED_CONTRACT",
          filename: input.originalName
        }
      );
      return r;
    });
    return viewOf(updated);
  };
}

/**
 * Attach a supporting document (image or PDF) to an open renewal. Once the
 * contract exists, a supporting document is what makes the renewal ready to
 * finalize (see `evaluateRenewalTransition`).
 */
export function createUploadRenewalDocument(client: PrismaClient) {
  return async (raw: UploadRenewalDocumentInput, actor: RenewalActor): Promise<LoanRenewalView> => {
    const parsed = uploadRenewalDocumentSchema.safeParse(raw);
    if (!parsed.success) throw new ValidationError(parsed.error);
    const input = parsed.data;

    const renewal = await loadRenewal(client, input.id);
    const to = decide(renewal, "uploadDocument", actor);
    const saved =
      input.mimeType === "application/pdf"
        ? saveContract({ dataBase64: input.dataBase64 })
        : saveImage({ dataBase64: input.dataBase64, mimeType: input.mimeType });

    const updated = await client.$transaction(async (tx) => {
      const { count } = await tx.loanRenewal.updateMany({
        where: { id: renewal.id, status: renewal.status },
        data: { status: to }
      });
      if (count === 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "La renovación cambió mientras subías el archivo; recarga e intenta de nuevo."
        });
      }
      await tx.customerDocument.create({
        data: {
          type: input.type,
          filename: saved.filename,
          originalName: input.originalName,
          mimeType: input.mimeType,
          size: saved.size,
          sha256: saved.sha256,
          source: "DIRECT",
          customerId: renewal.customerId,
          renewalId: renewal.id,
          uploadedById: actor.id
        }
      });
      const r = await loadRenewal(tx, renewal.id);
      await emitRenewalEvent(
        tx,
        "loan.renewal.document_uploaded",
        actor,
        r,
        "agregó un documento a la renovación",
        {
          kind: "DOCUMENT",
          filename: input.originalName
        }
      );
      return r;
    });
    return viewOf(updated);
  };
}
