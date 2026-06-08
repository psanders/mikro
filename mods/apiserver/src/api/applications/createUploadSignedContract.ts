/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { resolveReviewTransition } from "@mikro/common";
import type { DbClient, LoanApplication, UploadSignedContractInput } from "@mikro/common";
import { TRPCError } from "@trpc/server";
import { saveContract } from "../../applications/storage.js";
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
 * Store a signed contract PDF for an APPROVED application and move it to SIGNED.
 */
export function createUploadSignedContract(client: DbClient) {
  return async (input: UploadSignedContractInput, signedById: string): Promise<LoanApplication> => {
    const app = await loadByRef(client, input);
    const to = resolveReviewTransition("sign", app.status);
    if (!to) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Cannot upload a signed contract for an application in status ${app.status}.`
      });
    }
    const saved = saveContract({ dataBase64: input.dataBase64 });
    const updated = await client.loanApplication.update({
      where: { id: app.id },
      data: {
        status: to,
        contractFilename: saved.filename,
        contractOriginalName: input.originalName,
        contractMimeType: input.mimeType,
        contractSize: saved.size,
        contractSha256: saved.sha256,
        signedById,
        signedAt: new Date()
      }
    });
    logger.verbose("loan application signed", { id: app.id, filename: saved.filename, signedById });
    return updated;
  };
}
