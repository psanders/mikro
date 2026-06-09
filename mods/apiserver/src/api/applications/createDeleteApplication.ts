/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { DbClient, LoanApplication, DeleteApplicationInput } from "@mikro/common";
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
 * Manually purge (hard delete) a loan application. Irreversible: removes the row
 * and unlinks any stored contract file. A CONVERTED application is protected —
 * it owns a real Customer + Loan, so deleting it would orphan downstream records.
 */
export function createDeleteApplication(client: DbClient) {
  return async (input: DeleteApplicationInput, reviewerId: string): Promise<{ id: string }> => {
    const app = await loadByRef(client, input);
    if (app.status === "CONVERTED") {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A converted application cannot be deleted — it has an active customer and loan."
      });
    }

    await client.loanApplication.delete({ where: { id: app.id } });
    if (app.contractFilename) {
      try {
        deleteContract(app.contractFilename);
      } catch (error) {
        // Don't fail the purge on a leftover file; just log it.
        logger.warn("failed to delete contract file during purge", {
          id: app.id,
          filename: app.contractFilename,
          error: (error as Error).message
        });
      }
    }

    logger.info("loan application purged", { id: app.id, status: app.status, reviewerId });
    return { id: app.id };
  };
}
