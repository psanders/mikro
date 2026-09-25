/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Evidence gathered while an application is IN_REVIEW: business photos and
 * other documents (the cédula has its own two fixed slots, see
 * createUploadIdImage). Storage lives in plain functions that take an actor the
 * caller has already authenticated, so the planned token-authenticated mobile
 * capture link can reuse them without going through tRPC.
 */
import {
  getConfig,
  DEFAULT_MIN_BUSINESS_PHOTOS,
  type ApplicationDocument,
  type DbClient,
  type EvidenceStatus,
  type TransitionActor,
  type UploadApplicationDocumentInput
} from "@mikro/common";
import { TRPCError } from "@trpc/server";
import { readContract, readImage, saveContract, saveImage } from "../../applications/storage.js";
import { logger } from "../../logger.js";
import {
  assertEvidenceWritable,
  loadApplication,
  loadEvidenceStatus,
  type ApplicationRef
} from "./reviewApplication.js";

/** Minimum business photos before "send to decision" (config, default 3). */
export function getMinBusinessPhotos(): number {
  try {
    return getConfig().applications.minBusinessPhotos ?? DEFAULT_MIN_BUSINESS_PHOTOS;
  } catch {
    return DEFAULT_MIN_BUSINESS_PHOTOS;
  }
}

/**
 * Store one evidence file on an IN_REVIEW application the actor is assigned to.
 * Images go through the image store; PDFs (kind OTHER only — the input schema
 * refuses PDF business photos) through the contract store. Both are
 * content-addressed under the same directory.
 */
export async function storeApplicationDocument(
  client: DbClient,
  input: UploadApplicationDocumentInput,
  actor: TransitionActor
): Promise<ApplicationDocument> {
  const app = await loadApplication(client, input);
  assertEvidenceWritable(app, actor);

  let saved: { filename: string; size: number; sha256: string };
  try {
    saved =
      input.mimeType === "application/pdf"
        ? saveContract({ dataBase64: input.dataBase64 })
        : saveImage({ dataBase64: input.dataBase64, mimeType: input.mimeType });
  } catch (err) {
    throw new TRPCError({ code: "BAD_REQUEST", message: (err as Error).message });
  }

  const doc = await client.applicationDocument.create({
    data: {
      applicationId: app.id,
      kind: input.kind,
      label: input.label?.trim() || null,
      filename: saved.filename,
      originalName: input.originalName,
      mimeType: input.mimeType,
      size: saved.size,
      sha256: saved.sha256,
      uploadedById: actor.id
    }
  });
  logger.verbose("application document stored", {
    applicationId: app.id,
    documentId: doc.id,
    kind: doc.kind,
    by: actor.id
  });
  return doc;
}

/**
 * Remove an evidence document from an IN_REVIEW application. Only the row is
 * deleted: files are content-addressed and may be shared by reference (e.g. a
 * returning customer's documents), so the bytes are never unlinked here.
 */
export async function removeApplicationDocument(
  client: DbClient,
  documentId: string,
  actor: TransitionActor
): Promise<ApplicationDocument> {
  const doc = await client.applicationDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
  const app = await loadApplication(client, { id: doc.applicationId });
  assertEvidenceWritable(app, actor);
  return client.applicationDocument.delete({ where: { id: documentId } });
}

/** One evidence file's bytes, for the panel's thumbnails and viewer. */
export async function readApplicationDocument(
  client: DbClient,
  documentId: string
): Promise<{ document: ApplicationDocument; dataBase64: string }> {
  const doc = await client.applicationDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
  const read =
    doc.mimeType === "application/pdf" ? readContract(doc.filename) : readImage(doc.filename);
  return { document: doc, dataBase64: read.dataBase64 };
}

export interface ApplicationEvidence {
  status: EvidenceStatus;
  documents: ApplicationDocument[];
}

/** Completeness plus the document list (metadata only) for an application. */
export async function getApplicationEvidence(
  client: DbClient,
  ref: ApplicationRef
): Promise<ApplicationEvidence> {
  const app = await loadApplication(client, ref);
  const [status, documents] = await Promise.all([
    loadEvidenceStatus(client, app, getMinBusinessPhotos()),
    client.applicationDocument.findMany({
      where: { applicationId: app.id },
      orderBy: { createdAt: "asc" }
    })
  ]);
  return { status, documents };
}
