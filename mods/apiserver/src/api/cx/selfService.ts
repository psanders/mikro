/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Self-service tools for the WhatsApp CX agents (openspec
 * cx-role-based-agents). Every function takes the person's identity from the
 * conversation context the message handler built (`phone`, `customerId`,
 * `applicationId`) and ignores identifiers the model supplies, so an agent can
 * only ever read or change the sender's own records.
 *
 * What an applicant may see is enforced here, not only in the prompt: the
 * status payload never carries score, risk band, recommendation or reasons.
 */
import type { ApplicationStatus, DbClient } from "@mikro/common";
import type { ToolResult } from "@mikro/agents";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { saveImage } from "../../applications/storage.js";
import { buildLoanSnapshotFromDb } from "../loans/buildLoanSnapshotFromDb.js";
import { loadEvidenceStatus } from "../applications/reviewApplication.js";
import { getMinBusinessPhotos } from "../applications/evidence.js";
import type { OpenHandoffInput } from "./handoffs.js";
import { logger } from "../../logger.js";

type Context = Record<string, unknown> | undefined;

function str(ctx: Context, key: string): string | undefined {
  const v = ctx?.[key];
  return typeof v === "string" && v ? v : undefined;
}

const NO_CUSTOMER: ToolResult = {
  success: false,
  message: "Esta conversación no pertenece a un cliente."
};
const NO_APPLICATION: ToolResult = {
  success: false,
  message: "Esta conversación no tiene una solicitud asociada."
};

/** The sender's active loans, with the numbers the receipts use. */
export function createListMyLoans(db: PrismaClient, client: DbClient) {
  return async (context: Context): Promise<ToolResult> => {
    const customerId = str(context, "customerId");
    if (!customerId) return NO_CUSTOMER;
    const loans = await db.loan.findMany({
      where: { customerId, status: "ACTIVE" },
      select: { loanId: true },
      orderBy: { createdAt: "asc" }
    });
    const data = [];
    for (const { loanId } of loans) {
      const snap = await buildLoanSnapshotFromDb(client, loanId);
      if (!snap) continue;
      data.push({
        loanId,
        cuota: snap.terms.cuota,
        paymentFrequency: snap.terms.paymentFrequency,
        cuotasPagadas: snap.derived.cuotasCovered,
        cuotasTotales: snap.derived.termLength,
        balancePendiente: snap.derived.remainingBalance,
        moraPendiente: snap.derived.moraAccrued,
        proximoPago: snap.derived.nextDueDate,
        atrasado: snap.derived.isOverdue,
        diasAtraso: snap.derived.daysOverdue
      });
    }
    return {
      success: true,
      message: data.length
        ? `${data.length} préstamo(s) activo(s).`
        : "No tiene préstamos activos.",
      data
    };
  };
}

/** Payments of one of the sender's loans (the loan must be theirs). */
export function createListMyPayments(db: PrismaClient) {
  return async (args: Record<string, unknown>, context: Context): Promise<ToolResult> => {
    const customerId = str(context, "customerId");
    if (!customerId) return NO_CUSTOMER;
    const loanId = Number(args.loanId);
    const loan = Number.isInteger(loanId)
      ? await db.loan.findFirst({ where: { loanId, customerId }, select: { id: true } })
      : null;
    if (!loan) return { success: false, message: "No encontré ese préstamo entre los suyos." };
    const payments = await db.payment.findMany({
      where: { loanId: loan.id, status: { in: ["COMPLETED", "PARTIAL"] } },
      orderBy: { paidAt: "desc" },
      take: 10,
      select: { id: true, amount: true, paidAt: true, kind: true }
    });
    return {
      success: true,
      message: `${payments.length} pago(s) recientes.`,
      data: payments.map((p) => ({
        paymentId: p.id,
        amount: Number(p.amount),
        paidAt: p.paidAt,
        kind: p.kind
      }))
    };
  };
}

/** Resend the receipt of one of the sender's payments, always to the sender. */
export function createSendMyReceipt(
  db: PrismaClient,
  sendReceipt: (params: {
    paymentId: string;
    phone: string;
  }) => Promise<{ success: boolean; error?: string }>
) {
  return async (args: Record<string, unknown>, context: Context): Promise<ToolResult> => {
    const customerId = str(context, "customerId");
    const phone = str(context, "phone");
    if (!customerId || !phone) return NO_CUSTOMER;
    const paymentId = typeof args.paymentId === "string" ? args.paymentId : "";
    const payment = paymentId
      ? await db.payment.findFirst({
          where: { id: paymentId, loan: { customerId } },
          select: { id: true }
        })
      : null;
    if (!payment) return { success: false, message: "No encontré ese pago entre los suyos." };
    const result = await sendReceipt({ paymentId: payment.id, phone });
    return result.success
      ? { success: true, message: "Recibo enviado." }
      : { success: false, message: `No se pudo enviar el recibo: ${result.error ?? "error"}` };
  };
}

/** Plain-language stage for each pipeline status. Nothing else is exposed. */
const STAGE: Partial<Record<ApplicationStatus, string>> = {
  RECEIVED: "recibida",
  IN_REVIEW: "en revisión",
  PENDING_DECISION: "en revisión",
  APPROVED: "aprobada"
};

/** Statuses in which the applicant can still add evidence (before any decision). */
const EVIDENCE_OPEN: ReadonlySet<ApplicationStatus> = new Set(["RECEIVED", "IN_REVIEW"]);

/**
 * The business photos an applicant is asked for over WhatsApp, in order. The
 * labels match the Ops evidence view's suggestions, so a reviewer sees what
 * each photo was meant to show. Naming the shot keeps people from sending the
 * same picture again and again.
 */
const BUSINESS_SHOTS = [
  { label: "Fachada", ask: "el frente del negocio por fuera, con el letrero si tiene" },
  { label: "Interior", ask: "el interior del negocio, donde atiende o trabaja" },
  { label: "Mercancía", ask: "la mercancía, los productos o las herramientas de trabajo" }
] as const;

/** Asked for once every named shot is in and more photos are still required. */
const EXTRA_SHOT = { label: null, ask: "otra parte del negocio, distinta a las anteriores" };

interface EvidenceProgress {
  missingEvidence: string[];
  /** Present while business photos are missing: how many and which one is next. */
  businessPhotos?: { received: number; required: number; next: string };
}

/** The next business photo to ask for, skipping shots already labeled. */
function nextShot(labels: Array<string | null>): { label: string | null; ask: string } {
  const taken = new Set(labels.map((l) => l?.toLowerCase()));
  return BUSINESS_SHOTS.find((s) => !taken.has(s.label.toLowerCase())) ?? EXTRA_SHOT;
}

function businessPhotos(client: DbClient, applicationId: string) {
  return client.applicationDocument.findMany({ where: { applicationId, kind: "BUSINESS_PHOTO" } });
}

async function evidenceProgress(
  client: DbClient,
  applicationId: string
): Promise<EvidenceProgress> {
  const app = await client.loanApplication.findUnique({ where: { id: applicationId } });
  if (!app || !EVIDENCE_OPEN.has(app.status)) return { missingEvidence: [] };
  const status = await loadEvidenceStatus(client, app, getMinBusinessPhotos());
  const missing: string[] = [];
  if (!status.idFront) missing.push("ID_FRONT");
  if (!status.idBack) missing.push("ID_BACK");
  const { have, need } = status.businessPhotos;
  for (let i = have; i < need; i++) missing.push("BUSINESS_PHOTO");
  if (have >= need) return { missingEvidence: missing };
  const next = nextShot((await businessPhotos(client, app.id)).map((d) => d.label));
  return {
    missingEvidence: missing,
    businessPhotos: { received: have, required: need, next: next.ask }
  };
}

/** Whether this exact image is already on the application (cédula or business photo). */
async function isDuplicate(
  client: DbClient,
  app: { id: string; idFrontFilename?: string | null; idBackFilename?: string | null },
  sha256: string
): Promise<boolean> {
  const idFiles = [app.idFrontFilename, app.idBackFilename];
  if (idFiles.some((f) => f?.startsWith(`${sha256}.`))) return true;
  const docs = await client.applicationDocument.findMany({ where: { applicationId: app.id } });
  return docs.some((d) => d.sha256 === sha256);
}

/** The applicant's stage in plain words, plus the evidence still missing. */
export function createGetMyApplicationStatus(client: DbClient) {
  return async (context: Context): Promise<ToolResult> => {
    const applicationId = str(context, "applicationId");
    if (!applicationId) return NO_APPLICATION;
    const app = await client.loanApplication.findUnique({ where: { id: applicationId } });
    const stage = app ? STAGE[app.status] : undefined;
    if (!app || !stage) return NO_APPLICATION;
    return {
      success: true,
      message: `Solicitud ${stage}.`,
      data: { stage, ...(await evidenceProgress(client, app.id)) }
    };
  };
}

const DATA_URL_RE = /^data:(image\/[a-z+]+);base64,(.+)$/;

/**
 * Attach the image the applicant sent this turn. The image comes from the
 * handler's context, never from a model-supplied URL. Allowed only before a
 * decision is in progress (RECEIVED, IN_REVIEW): once sent to decision the
 * evidence is what the admin decides on.
 */
export function createAttachApplicationEvidence(client: DbClient) {
  return async (args: Record<string, unknown>, context: Context): Promise<ToolResult> => {
    const applicationId = str(context, "applicationId");
    const phone = str(context, "phone");
    if (!applicationId || !phone) return NO_APPLICATION;
    const kind = args.kind;
    if (kind !== "ID_FRONT" && kind !== "ID_BACK" && kind !== "BUSINESS_PHOTO") {
      return { success: false, message: "kind debe ser ID_FRONT, ID_BACK o BUSINESS_PHOTO." };
    }
    const match = DATA_URL_RE.exec(str(context, "imageDataUrl") ?? "");
    if (!match) {
      return { success: false, message: "No hay una foto en este mensaje para adjuntar." };
    }
    const app = await client.loanApplication.findUnique({ where: { id: applicationId } });
    if (!app || !EVIDENCE_OPEN.has(app.status)) {
      return {
        success: false,
        message: "La solicitud ya no admite documentos; el equipo le contactará si hace falta algo."
      };
    }

    let saved: { filename: string; size: number; sha256: string };
    try {
      saved = saveImage({ dataBase64: match[2], mimeType: match[1] });
    } catch (err) {
      return { success: false, message: `No se pudo guardar la foto: ${(err as Error).message}` };
    }
    // Not a user id: the applicant uploaded it themselves over WhatsApp.
    const uploadedById = `whatsapp:${phone}`;
    const originalName = `whatsapp-${Date.now()}`;

    // Files are content-addressed, so the same picture sent again has the same
    // sha256. Keep nothing and ask for a different one.
    if (await isDuplicate(client, app, saved.sha256)) {
      return {
        success: false,
        message:
          "Esa foto ya la habíamos recibido; no se adjuntó de nuevo. Pide una foto distinta de lo que falta.",
        data: await evidenceProgress(client, app.id)
      };
    }

    if (kind === "BUSINESS_PHOTO") {
      await client.applicationDocument.create({
        data: {
          applicationId: app.id,
          kind: "BUSINESS_PHOTO",
          label: nextShot((await businessPhotos(client, app.id)).map((d) => d.label)).label,
          filename: saved.filename,
          originalName,
          mimeType: match[1],
          size: saved.size,
          sha256: saved.sha256,
          uploadedById
        }
      });
    } else {
      const front = kind === "ID_FRONT";
      await client.loanApplication.update({
        where: { id: app.id },
        data: front
          ? {
              idFrontFilename: saved.filename,
              idFrontOriginalName: originalName,
              idFrontMimeType: match[1],
              idFrontSize: saved.size,
              idUploadedById: uploadedById,
              idUploadedAt: new Date()
            }
          : {
              idBackFilename: saved.filename,
              idBackOriginalName: originalName,
              idBackMimeType: match[1],
              idBackSize: saved.size,
              idUploadedById: uploadedById,
              idUploadedAt: new Date()
            }
      });
    }
    logger.info("applicant attached evidence over whatsapp", { applicationId: app.id, kind });
    return {
      success: true,
      message: "Foto adjuntada.",
      data: await evidenceProgress(client, app.id)
    };
  };
}

/** Hand the conversation to a human; profile and subject come from context. */
export function createRequestHumanHandoff(
  openHandoff: (input: OpenHandoffInput) => Promise<{ opened: boolean }>
) {
  return async (args: Record<string, unknown>, context: Context): Promise<ToolResult> => {
    const phone = str(context, "phone");
    const profile = str(context, "profile");
    if (!phone || !profile) return { success: false, message: "Falta el contexto del contacto." };
    const reason =
      typeof args.reason === "string" && args.reason.trim() ? args.reason.trim() : "Sin motivo";
    const summary =
      typeof args.summary === "string" && args.summary.trim()
        ? args.summary.trim().slice(0, 800)
        : undefined;
    await openHandoff({
      phone,
      profile,
      reason: reason.slice(0, 200),
      applicationId: str(context, "applicationId"),
      customerId: str(context, "customerId"),
      displayName: str(context, "name"),
      whatsappUserId: str(context, "whatsappUserId"),
      username: str(context, "username"),
      summary
    });
    return {
      success: true,
      message:
        "Conversación pasada a una persona del equipo. Despídete brevemente diciendo que alguien del equipo le responderá por aquí; no hagas más preguntas."
    };
  };
}
