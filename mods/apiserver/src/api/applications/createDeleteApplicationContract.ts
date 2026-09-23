/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type {
  DbClient,
  LoanApplication,
  DeleteApplicationContractInput,
  TransitionActor
} from "@mikro/common";
import { TRPCError } from "@trpc/server";
import { deleteContract } from "../../applications/storage.js";
import { logger } from "../../logger.js";
import { assertApprovedStepWritable } from "./reviewApplication.js";

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
 * Remove a stored signed contract so the reviewer can re-upload a corrected
 * document. The application stays APPROVED (a contract is a requirement of
 * conversion, not a status).
 */
export function createDeleteApplicationContract(client: DbClient) {
  return async (
    input: DeleteApplicationContractInput,
    actor: TransitionActor
  ): Promise<LoanApplication> => {
    const app = await loadByRef(client, input);
    assertApprovedStepWritable(app, actor);

    if (!app.contractFilename) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No contract stored for this application."
      });
    }

    const prev = app.contractFilename;

    const updated = await client.loanApplication.update({
      where: { id: app.id },
      data: {
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
