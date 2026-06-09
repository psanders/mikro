/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { DbClient, LoanApplication, UploadIdImageInput } from "@mikro/common";
import { TRPCError } from "@trpc/server";
import { saveImage, deleteImage } from "../../applications/storage.js";
import { logger } from "../../logger.js";

async function loadByRef(
  client: DbClient,
  ref: { id?: string; sessionId?: string }
): Promise<LoanApplication> {
  const app = ref.id
    ? await client.loanApplication.findUnique({ where: { id: ref.id } })
    : await client.loanApplication.findFirst({ where: { sessionId: ref.sessionId! } });
  if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Loan application not found" });
  return app;
}

/**
 * Store one side of the applicant's cédula (static image, no extraction). The
 * front/back columns are content-addressed; replacing a side re-saves and
 * unlinks the previous file when it is no longer referenced.
 */
export function createUploadIdImage(client: DbClient) {
  return async (input: UploadIdImageInput, uploadedById: string): Promise<LoanApplication> => {
    const app = await loadByRef(client, input);
    if (app.status === "CONVERTED") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Cannot change documents on a converted application."
      });
    }

    const saved = saveImage({ dataBase64: input.dataBase64, mimeType: input.mimeType });
    const isFront = input.side === "FRONT";
    const prev = isFront ? app.idFrontFilename : app.idBackFilename;

    const data = isFront
      ? {
          idFrontFilename: saved.filename,
          idFrontOriginalName: input.originalName,
          idFrontMimeType: input.mimeType,
          idFrontSize: saved.size,
          idUploadedById: uploadedById,
          idUploadedAt: new Date()
        }
      : {
          idBackFilename: saved.filename,
          idBackOriginalName: input.originalName,
          idBackMimeType: input.mimeType,
          idBackSize: saved.size,
          idUploadedById: uploadedById,
          idUploadedAt: new Date()
        };

    const updated = await client.loanApplication.update({ where: { id: app.id }, data });

    // Drop the replaced file if nothing else (the other side) points at it.
    if (prev && prev !== saved.filename) {
      const stillUsed = updated.idFrontFilename === prev || updated.idBackFilename === prev;
      if (!stillUsed) {
        try {
          deleteImage(prev);
        } catch (error) {
          logger.warn("failed to delete replaced id image", {
            id: app.id,
            filename: prev,
            error: (error as Error).message
          });
        }
      }
    }

    logger.verbose("id image uploaded", {
      id: app.id,
      side: input.side,
      filename: saved.filename,
      uploadedById
    });
    return updated;
  };
}
