/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { DbClient, LoanApplication, DeleteIdImageInput } from "@mikro/common";
import { TRPCError } from "@trpc/server";
import { deleteImage } from "../../applications/storage.js";
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

/** Remove one side of the applicant's cédula and unlink the stored file. */
export function createDeleteIdImage(client: DbClient) {
  return async (input: DeleteIdImageInput): Promise<LoanApplication> => {
    const app = await loadByRef(client, input);
    if (app.status === "CONVERTED") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Cannot change documents on a converted application."
      });
    }

    const isFront = input.side === "FRONT";
    const prev = isFront ? app.idFrontFilename : app.idBackFilename;

    if (!prev) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No image stored for that side." });
    }

    const data = isFront
      ? {
          idFrontFilename: null,
          idFrontOriginalName: null,
          idFrontMimeType: null,
          idFrontSize: null
        }
      : {
          idBackFilename: null,
          idBackOriginalName: null,
          idBackMimeType: null,
          idBackSize: null
        };

    const updated = await client.loanApplication.update({ where: { id: app.id }, data });

    // Unlink file only if neither side still references it.
    const stillUsed = updated.idFrontFilename === prev || updated.idBackFilename === prev;
    if (!stillUsed) {
      try {
        deleteImage(prev);
      } catch (error) {
        logger.warn("failed to delete id image", {
          id: app.id,
          filename: prev,
          error: (error as Error).message
        });
      }
    }

    logger.verbose("id image deleted", { id: app.id, side: input.side, filename: prev });
    return updated;
  };
}
