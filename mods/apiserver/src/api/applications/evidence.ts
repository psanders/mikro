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
  evidenceProgress,
  DEFAULT_MIN_BUSINESS_PHOTOS,
  type ApplicationDocument,
  type DbClient,
  type EvidenceStatus,
  type LoanApplication,
  type SetApplicationMapUrlInput,
  type TransitionActor,
  type UploadApplicationDocumentInput
} from "@mikro/common";
import { TRPCError } from "@trpc/server";
import { readContract, readImage, saveContract, saveImage } from "../../applications/storage.js";
import { logger } from "../../logger.js";
import { recordEvidenceCompleted } from "../events/recordEvidenceCompleted.js";
import type { EventClient } from "../events/recordEvent.js";
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

/**
 * Run an evidence write and, when it takes the evidence from incomplete to
 * complete and the writer isn't the assignee (a collector in the field), record
 * one `application.evidence_completed` event for the reviewer. Deletions can't
 * complete evidence, so only additive writes go through this.
 */
export async function trackEvidenceCompletion<T>(
  client: DbClient,
  ref: ApplicationRef,
  actor: TransitionActor,
  write: () => Promise<T>
): Promise<T> {
  const min = getMinBusinessPhotos();
  const app = await loadApplication(client, ref);
  const before = await loadEvidenceStatus(client, app, min);
  const result = await write();
  if (before.complete || app.assignedReviewerId === actor.id) return result;
  try {
    const fresh = await loadApplication(client, { id: app.id });
    const after = await loadEvidenceStatus(client, fresh, min);
    if (after.complete) {
      await recordEvidenceCompleted(client as unknown as EventClient, fresh, actor.id);
    }
  } catch (err) {
    logger.error("failed to record evidence completion", {
      applicationId: app.id,
      error: (err as Error).message
    });
  }
  return result;
}

/** Set or clear the business location map link (evidence rules apply). */
export async function setApplicationMapUrl(
  client: DbClient,
  input: SetApplicationMapUrlInput,
  actor: TransitionActor
): Promise<LoanApplication> {
  const app = await loadApplication(client, input);
  assertEvidenceWritable(app, actor);
  return client.loanApplication.update({
    where: { id: app.id },
    data: { mapUrl: input.mapUrl }
  });
}

/**
 * Evidence reads for collectors are limited to applications in review (the
 * only ones they work on); reviewers and admins read any.
 */
export function assertEvidenceReadable(app: LoanApplication, actor: TransitionActor): void {
  const reviewer = actor.roles.includes("REVIEWER") || actor.roles.includes("ADMIN");
  if (!reviewer && app.status !== "IN_REVIEW") {
    throw new TRPCError({ code: "NOT_FOUND", message: "Loan application not found" });
  }
}

/** The contact and address fields a collector needs for the visit. */
function visitFields(app: LoanApplication) {
  const raw = (app.rawData as Record<string, unknown> | null) ?? {};
  const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    id: app.id,
    firstName: app.firstName,
    lastName: app.lastName,
    businessName: app.businessName,
    phone: app.phone,
    homeAddress: app.homeAddress,
    province: app.province,
    addressReference: text(raw.addressReference),
    inReviewSince: app.assignedAt ?? app.updatedAt
  };
}

export interface EvidenceQueueItem extends ReturnType<typeof visitFields> {
  progress: { have: number; need: number };
  complete: boolean;
}

/**
 * The collector's evidence list: every application IN_REVIEW, the one that
 * entered review first at the top, each with its progress. Complete ones stay
 * listed (marked) until the application leaves review.
 */
export async function listEvidenceQueue(client: DbClient): Promise<EvidenceQueueItem[]> {
  const min = getMinBusinessPhotos();
  const entered = (a: LoanApplication) => (a.assignedAt ?? a.createdAt).getTime();
  const apps = (await client.loanApplication.findMany({ where: { status: "IN_REVIEW" } })).sort(
    (a, b) => entered(a) - entered(b)
  );
  return Promise.all(
    apps.map(async (app) => {
      const status = await loadEvidenceStatus(client, app, min);
      return { ...visitFields(app), progress: evidenceProgress(status), complete: status.complete };
    })
  );
}

export interface EvidenceTask extends ReturnType<typeof visitFields> {
  mapUrl: string | null;
  idFront: boolean;
  idBack: boolean;
  documents: Array<{
    id: string;
    kind: ApplicationDocument["kind"];
    label: string | null;
    mimeType: string;
    originalName: string;
  }>;
  status: EvidenceStatus;
  progress: { have: number; need: number };
}

/**
 * One application as a collector sees it: visit fields and evidence only — no
 * score, recommendation, terms or decision data. NOT_FOUND unless IN_REVIEW.
 */
export async function getEvidenceTask(
  client: DbClient,
  ref: ApplicationRef
): Promise<EvidenceTask> {
  const app = await loadApplication(client, ref);
  if (app.status !== "IN_REVIEW") {
    throw new TRPCError({ code: "NOT_FOUND", message: "Loan application not found" });
  }
  const { status, documents } = await getApplicationEvidence(client, { id: app.id });
  return {
    ...visitFields(app),
    mapUrl: app.mapUrl,
    idFront: Boolean(app.idFrontFilename),
    idBack: Boolean(app.idBackFilename),
    documents: documents.map((d) => ({
      id: d.id,
      kind: d.kind,
      label: d.label,
      mimeType: d.mimeType,
      originalName: d.originalName
    })),
    status,
    progress: evidenceProgress(status)
  };
}
