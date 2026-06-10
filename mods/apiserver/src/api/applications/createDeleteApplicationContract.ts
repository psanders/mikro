/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { DbClient, LoanApplication, DeleteApplicationContractInput } from "@mikro/common";
import { TRPCError } from "@trpc/server";
import { deleteContract } from "../../applications/storage.js";
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
 * Remove a stored signed contract and revert SIGNED → APPROVED so the
 * reviewer can re-upload a corrected document.
 */
export function createDeleteApplicationContract(client: DbClient) {
  return async (input: DeleteApplicationContractInput): Promise<LoanApplication> => {
    const app = await loadByRef(client, input);

    if (app.status === "CONVERTED") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Cannot remove the contract from a converted application."
      });
    }

    if (!app.contractFilename) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No contract stored for this application." });
    }

    const prev = app.contractFilename;

    const updated = await client.loanApplication.update({
      where: { id: app.id },
      data: {
        // Revert to APPROVED only if currently SIGNED; leave other statuses unchanged.
        ...(app.status === "SIGNED" ? { status: "APPROVED" } : {}),
        contractFilename: null,
        contractOriginalName: null,
        contractMimeType: null,
        contractSize: null,
        contractSha256: null,
        signedById: null,
        signedAt: null
      }
    });

    try {
      deleteContract(prev);
    } catch (error) {
      logger.warn("failed to delete contract file", {
        id: app.id,
        filename: prev,
        error: (error as Error).message
      });
    }

    logger.verbose("contract deleted", { id: app.id, filename: prev });
    return updated;
  };
}
