/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { DbClient, LoanApplication, GetIdImageInput } from "@mikro/common";
import { TRPCError } from "@trpc/server";
import { readImage } from "../../applications/storage.js";

export interface IdImage {
  dataBase64: string;
  mimeType: string;
  originalName: string;
  size: number;
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
 * Fetch a stored cédula image (front/back) for an application as base64.
 */
export function createGetIdImage(client: DbClient) {
  return async (input: GetIdImageInput): Promise<IdImage> => {
    const app = await loadByRef(client, input);
    const isFront = input.side === "FRONT";
    const filename = isFront ? app.idFrontFilename : app.idBackFilename;
    const mimeType = isFront ? app.idFrontMimeType : app.idBackMimeType;
    const originalName = isFront ? app.idFrontOriginalName : app.idBackOriginalName;
    if (!filename || !mimeType) {
      throw new TRPCError({ code: "NOT_FOUND", message: "No image uploaded for this side." });
    }
    const { dataBase64, size } = readImage(filename);
    return { dataBase64, mimeType, originalName: originalName ?? filename, size };
  };
}
