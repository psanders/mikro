/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { DbClient, LoanApplication, GetApplicationContractInput } from "@mikro/common";
import { TRPCError } from "@trpc/server";
import { readContract } from "../../applications/storage.js";

export interface ApplicationContract {
  dataBase64: string;
  filename: string;
  originalName: string | null;
  mimeType: string | null;
  size: number | null;
  sha256: string | null;
}

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
 * Return the stored signed contract (base64 + metadata) for an application.
 */
export function createGetApplicationContract(client: DbClient) {
  return async (input: GetApplicationContractInput): Promise<ApplicationContract> => {
    const app = await loadByRef(client, input);
    if (!app.contractFilename) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No contract on file for this application"
      });
    }
    const { dataBase64 } = readContract(app.contractFilename);
    return {
      dataBase64,
      filename: app.contractFilename,
      originalName: app.contractOriginalName,
      mimeType: app.contractMimeType,
      size: app.contractSize,
      sha256: app.contractSha256
    };
  };
}
