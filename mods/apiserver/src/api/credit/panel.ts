/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Everything the Mikro Decisión panel shows for a cédula, and the ingest that
 * stores a pushed report. The panel offers only the evaluator's existing review
 * actions, computed with the same `evaluateTransition` rules as the Ops app.
 */
import {
  creditReportPushSchema,
  CREDIT_REPORT_SCHEMA_VERSION,
  normalizeCedula,
  type CreditReportPush
} from "@mikro/score";
import { evaluateTransition, type RejectionReason, type TransitionActor } from "@mikro/common";
import { TRPCError } from "@trpc/server";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { forTransition, loadEvidenceStatus } from "../applications/reviewApplication.js";
import {
  decideApplication,
  findOpenApplicationByCedula,
  latestDecision,
  type StoredDecision
} from "./decide.js";
import { cedulaVariants } from "./cedula.js";
import type { DbClient, LoanApplication } from "@mikro/common";

export interface PanelApplication {
  id: string;
  name: string;
  requestedAmount: number | null;
  requestedTermWeeks: number | null;
  status: string;
  assigneeName: string | null;
  isMine: boolean;
  reviewerRecommendation: string | null;
  evidence: { complete: boolean; missing: string[] };
}

export interface PanelActions {
  /** RECEIVED and the caller may take it ("Tomar solicitud"). */
  take: boolean;
  /** The caller may reject now (today's rules). */
  reject: boolean;
  /** Preselected reason when the policy says NO (no note needed). */
  hardNoReason: RejectionReason | null;
  /** The caller may write a recommendation and send to decision. */
  recommend: boolean;
  /** Why "Enviar a decisión" is blocked (e.g. missing evidence), if it is. */
  sendBlockedBy: string[];
}

export interface CreditPanel {
  cedula: string;
  application: PanelApplication | null;
  decision: StoredDecision | null;
  previousScore: number | null;
  actions: PanelActions;
  lastReports: { source: string; capturedAt: Date }[];
}

const NO_ACTIONS: PanelActions = {
  take: false,
  reject: false,
  hardNoReason: null,
  recommend: false,
  sendBlockedBy: []
};

function missingEvidence(e: Awaited<ReturnType<typeof loadEvidenceStatus>>): string[] {
  const out: string[] = [];
  if (!e.location) out.push("Mapa del negocio");
  if (!e.idFront || !e.idBack) out.push("Cédula (frente y dorso)");
  const lack = e.businessPhotos.need - e.businessPhotos.have;
  if (lack > 0) out.push(`${lack} foto${lack === 1 ? "" : "s"} del negocio`);
  return out;
}

function hardNoReason(decision: StoredDecision | null): RejectionReason | null {
  if (decision?.outcome !== "REJECT" || decision.reasons.length === 0) return null;
  // Out of area alone keeps its own reason (Lucía's out-of-area message relies on it).
  return decision.reasons.every((r) => r.code === "OUT_OF_COVERAGE_AREA")
    ? "OUT_OF_COVERAGE_AREA"
    : "CREDIT_POLICY";
}

async function nameOf(db: PrismaClient, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const u = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
  return u?.name ?? null;
}

export async function getCreditPanel(
  db: PrismaClient,
  rawCedula: string,
  actor: TransitionActor,
  opts: { minBusinessPhotos: number }
): Promise<CreditPanel> {
  const cedula = normalizeCedula(rawCedula);
  if (!cedula) throw new TRPCError({ code: "BAD_REQUEST", message: "Cédula inválida" });

  const reports = await db.creditReport.findMany({
    where: { cedula },
    orderBy: { capturedAt: "desc" },
    select: { source: true, capturedAt: true }
  });
  const lastReports = ["EQUIFAX", "PRESTAMOSCLOUD"]
    .map((s) => reports.find((r) => r.source === s))
    .filter((r): r is { source: "EQUIFAX" | "PRESTAMOSCLOUD"; capturedAt: Date } => !!r);

  const app = await findOpenApplicationByCedula(db, cedula);
  if (!app) {
    return {
      cedula,
      application: null,
      decision: null,
      previousScore: null,
      actions: NO_ACTIONS,
      lastReports
    };
  }

  const history = await db.creditDecision.findMany({
    where: { applicationId: app.id },
    orderBy: { createdAt: "desc" },
    take: 2,
    select: { mikroScore: true }
  });
  const decision = await latestDecision(db, app.id);
  const loan = app as unknown as LoanApplication;
  const evidence = await loadEvidenceStatus(
    db as unknown as DbClient,
    loan,
    opts.minBusinessPhotos
  );
  const t = forTransition(loan);
  const can = (action: "assign" | "reject" | "sendToDecision", input = {}) =>
    evaluateTransition(t, action, actor, input, { evidence }, { ignoreInput: true });
  const send = can("sendToDecision");
  const sendWho =
    send.ok || send.reason === "EVIDENCE_INCOMPLETE" || send.reason === "RECOMMENDATION_REQUIRED";

  return {
    cedula,
    application: {
      id: app.id,
      name: [app.firstName, app.lastName].filter(Boolean).join(" ") || "Sin nombre",
      requestedAmount: app.requestedAmount == null ? null : Number(app.requestedAmount),
      requestedTermWeeks: app.requestedTermWeeks,
      status: app.status,
      assigneeName: await nameOf(db, app.assignedReviewerId),
      isMine: app.assignedReviewerId === actor.id,
      reviewerRecommendation: app.reviewerRecommendation,
      evidence: { complete: evidence.complete, missing: missingEvidence(evidence) }
    },
    decision,
    previousScore: history[1]?.mikroScore ?? null,
    actions: {
      take: app.status === "RECEIVED" && can("assign").ok,
      reject: can("reject").ok,
      hardNoReason: hardNoReason(decision),
      recommend: sendWho,
      sendBlockedBy: evidence.complete ? [] : missingEvidence(evidence)
    },
    lastReports
  };
}

/** Stores a pushed report and re-decides the cédula's open application. */
export async function ingestCreditReport(
  db: PrismaClient,
  raw: CreditReportPush,
  actor: TransitionActor,
  opts: { minBusinessPhotos: number }
): Promise<CreditPanel> {
  const push = creditReportPushSchema.parse(raw);
  const open = await findOpenApplicationByCedula(db, push.cedula);
  if (push.applicationId) {
    const app = await db.loanApplication.findUnique({ where: { id: push.applicationId } });
    if (!app || !cedulaVariants(push.cedula).includes(app.idNumber ?? "")) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "La cédula no coincide con la solicitud [CEDULA_MISMATCH]"
      });
    }
  }
  await db.creditReport.create({
    data: {
      cedula: push.cedula,
      source: push.source,
      facts: JSON.parse(JSON.stringify(push.facts)),
      schemaVersion: CREDIT_REPORT_SCHEMA_VERSION,
      rawSha256: push.rawSha256,
      adapterVersion: push.adapterVersion,
      portalOrigin: push.portalOrigin,
      capturedAt: new Date(push.capturedAt),
      capturedById: actor.id,
      applicationId: push.applicationId ?? open?.id ?? null
    }
  });
  if (open) await decideApplication(db, open.id);
  return getCreditPanel(db, push.cedula, actor, opts);
}

/** Report history for a cédula (no facts: just what was looked up, when, by whom). */
export async function listCreditReports(db: PrismaClient, rawCedula: string) {
  const cedula = normalizeCedula(rawCedula);
  if (!cedula) throw new TRPCError({ code: "BAD_REQUEST", message: "Cédula inválida" });
  return db.creditReport.findMany({
    where: { cedula },
    orderBy: { capturedAt: "desc" },
    select: {
      id: true,
      source: true,
      capturedAt: true,
      capturedById: true,
      applicationId: true,
      adapterVersion: true
    }
  });
}
