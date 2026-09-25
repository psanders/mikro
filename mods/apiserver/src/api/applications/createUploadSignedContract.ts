/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type {
  DbClient,
  LoanApplication,
  TransitionActor,
  UploadSignedContractInput
} from "@mikro/common";
import { saveContract } from "../../applications/storage.js";
import { logger } from "../../logger.js";
import { assertApprovedStepWritable, loadApplication } from "./reviewApplication.js";

/**
 * Store (or replace) the signed contract PDF of an APPROVED application. The
 * status does not change: a stored contract is what `convert` requires.
 */
export function createUploadSignedContract(client: DbClient) {
  return async (
    input: UploadSignedContractInput,
    actor: TransitionActor
  ): Promise<LoanApplication> => {
    const app = await loadApplication(client, input);
    assertApprovedStepWritable(app, actor);
    const saved = saveContract({ dataBase64: input.dataBase64 });
    const updated = await client.loanApplication.update({
      where: { id: app.id },
      data: {
        contractFilename: saved.filename,
        contractOriginalName: input.originalName,
        contractMimeType: input.mimeType,
        contractSize: saved.size,
        contractSha256: saved.sha256,
        signedById: actor.id,
        signedAt: new Date()
      }
    });
    logger.verbose("signed contract stored", {
      id: app.id,
      filename: saved.filename,
      by: actor.id
    });
    return updated;
  };
}
