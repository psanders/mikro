/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Runs the credit policy for an application and appends a CreditDecision
 * (input snapshot, policy id/version/hash, outcome, reasons, trace) so every
 * decision can be replayed. Re-run after every application write and after
 * every credit report pushed for the application's cédula.
 */
import { evaluateCreditPolicy, type Decision } from "@mikro/score";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { logger } from "../../logger.js";
import { buildCreditFacts } from "./facts.js";
import { getCreditPolicy } from "./policy.js";
import { cedulaVariants } from "./cedula.js";

/** Statuses whose decision still matters (open applications). */
export const DECIDABLE_STATUSES = ["RECEIVED", "IN_REVIEW", "PENDING_DECISION"] as const;

export type StoredDecision = Decision & {
  id: string;
  applicationId: string;
  policyId: string;
  policyVersion: string;
  createdAt: Date;
};

type Row = Awaited<ReturnType<PrismaClient["creditDecision"]["findFirstOrThrow"]>>;

export function toStoredDecision(row: Row): StoredDecision {
  return {
    id: row.id,
    applicationId: row.applicationId,
    policyId: row.policyId,
    policyVersion: row.policyVersion,
    createdAt: row.createdAt,
    outcome: row.outcome,
    mikroScore: row.mikroScore,
    reasons: row.reasons as unknown as Decision["reasons"],
    unchecked: row.unchecked as unknown as Decision["unchecked"],
    components: row.components as unknown as Decision["components"],
    sourcesUsed: (row.components as unknown as Decision["components"])
      .filter((c) => c.used)
      .map((c) => c.id),
    nextSteps: row.nextSteps as unknown as Decision["nextSteps"],
    trace: row.trace as unknown as Decision["trace"]
  };
}

export async function decideApplication(
  db: PrismaClient,
  applicationId: string,
  now: Date = new Date()
): Promise<StoredDecision> {
  const app = await db.loanApplication.findUniqueOrThrow({ where: { id: applicationId } });
  const { policy, hash } = getCreditPolicy();
  const { facts } = await buildCreditFacts(db, app, policy, now);
  const d = evaluateCreditPolicy(policy, facts, now);
  const json = (v: unknown) => JSON.parse(JSON.stringify(v));
  const row = await db.creditDecision.create({
    data: {
      applicationId,
      policyId: policy.id,
      policyVersion: policy.version,
      policyHash: hash,
      outcome: d.outcome,
      mikroScore: d.mikroScore,
      reasons: json(d.reasons),
      unchecked: json(d.unchecked),
      components: json(d.components),
      nextSteps: json(d.nextSteps),
      inputs: json({ facts, now: now.toISOString() }),
      trace: json(d.trace)
    }
  });
  return toStoredDecision(row);
}

export async function latestDecision(
  db: PrismaClient,
  applicationId: string
): Promise<StoredDecision | null> {
  const row = await db.creditDecision.findFirst({
    where: { applicationId },
    orderBy: { createdAt: "desc" }
  });
  return row ? toStoredDecision(row) : null;
}

/**
 * Fire-and-forget re-decision after an application write. A failure is logged,
 * never surfaced: the write itself already succeeded.
 */
export function scheduleDecision(db: unknown, app: { id: string; status: string }): void {
  if (!(DECIDABLE_STATUSES as readonly string[]).includes(app.status)) return;
  // Narrow DbClient stubs (unit tests) have no credit tables: nothing to decide.
  if (
    typeof (db as { creditDecision?: { create?: unknown } }).creditDecision?.create !== "function"
  ) {
    return;
  }
  const applicationId = app.id;
  void decideApplication(db as PrismaClient, applicationId).catch((error: unknown) =>
    logger.error("credit decision failed", {
      applicationId,
      error: (error as Error).message
    })
  );
}

/** The single open application for a cédula (one per person since #339), if any. */
export async function findOpenApplicationByCedula(db: PrismaClient, cedula: string) {
  return db.loanApplication.findFirst({
    where: { idNumber: { in: cedulaVariants(cedula) }, status: { in: [...DECIDABLE_STATUSES] } },
    // Pre-#339 duplicates can still exist: the newest one is the live one.
    orderBy: { createdAt: "desc" }
  });
}
