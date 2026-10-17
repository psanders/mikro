/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Builds the facts object the credit policy reads (layout documented in
 * @mikro/score policy/v1.ts). Rule: a value that isn't known is OMITTED, never
 * set to null — the evaluator treats a missing fact as "not checked", while
 * null is a known empty value (e.g. PrestamosCloud "NO DATOS").
 */
import {
  extractFeatures,
  nameMatches,
  birthDateMatches,
  scoreReport,
  type CreditPolicy,
  type EquifaxFacts,
  type Facts,
  type PcloudFacts
} from "@mikro/score";
import { getConfig, getPaymentRating, normalizeProvinceKey } from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";
import { cedulaVariants, normalizeCedula } from "./cedula.js";

type App = Awaited<ReturnType<PrismaClient["loanApplication"]["findUniqueOrThrow"]>>;

const DAY_MS = 86_400_000;

function ageYears(dob: Date, now: Date): number {
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const m = now.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < dob.getUTCDate())) age--;
  return age;
}

/** Drops undefined values so the evaluator sees them as missing. */
function compact<T extends Record<string, unknown>>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

async function latestReport(
  db: PrismaClient,
  cedula: string,
  source: "EQUIFAX" | "PRESTAMOSCLOUD",
  maxAgeDays: number | undefined,
  now: Date
) {
  const report = await db.creditReport.findFirst({
    where: { cedula, source },
    orderBy: { capturedAt: "desc" }
  });
  if (!report) return null;
  const ageDays = Math.floor((now.getTime() - report.capturedAt.getTime()) / DAY_MS);
  if (maxAgeDays !== undefined && ageDays > maxAgeDays) return null;
  return { report, ageDays };
}

function identityChecks(app: App, identity: { fullName: string; birthDate?: string } | null) {
  if (!identity) return undefined;
  return compact({
    nameMatches: nameMatches(
      { firstName: app.firstName, lastName: app.lastName },
      identity.fullName
    ),
    birthDateMatches:
      identity.birthDate && app.dateOfBirth
        ? birthDateMatches(app.dateOfBirth.toISOString().slice(0, 10), identity.birthDate)
        : undefined
  });
}

async function mikroHistory(db: PrismaClient, cedula: string, now: Date) {
  const customer = await db.customer.findFirst({
    where: { idNumber: { in: cedulaVariants(cedula) } },
    include: {
      tags: { select: { tag: true } },
      loans: { include: { payments: { select: { paidAt: true, status: true, amount: true } } } }
    }
  });
  if (!customer) return { customerExists: false, tags: [], loans: [] };
  const ratings = customer.loans
    .filter((l) => l.payments.length > 0 || l.status !== "CANCELLED")
    .map((l) =>
      getPaymentRating(
        {
          paymentFrequency: l.paymentFrequency,
          createdAt: l.startingDate ?? l.createdAt,
          paymentAmount: Number(l.paymentAmount),
          payments: l.payments.map((p) => ({
            paidAt: p.paidAt,
            status: p.status,
            amount: Number(p.amount)
          }))
        },
        now
      )
    );
  return compact({
    customerExists: true,
    tags: customer.tags.map((t) => t.tag),
    loans: customer.loans.map((l) => ({ status: l.status, writtenOff: l.status === "DEFAULTED" })),
    // Worst rating across loans; a customer with no loans has no history to score.
    paymentRating: ratings.length ? Math.min(...ratings) : undefined
  });
}

export interface BuiltFacts {
  facts: Facts;
  cedula: string | null;
}

export async function buildCreditFacts(
  db: PrismaClient,
  app: App,
  policy: CreditPolicy,
  now: Date = new Date()
): Promise<BuiltFacts> {
  const cedula = normalizeCedula(app.idNumber);
  const isc = app.scoreData as { flags?: string[] } | null;
  const facts: Facts = {
    app: compact({
      province: app.province ?? undefined,
      requestedAmount: app.requestedAmount == null ? undefined : Number(app.requestedAmount),
      requestedTermWeeks: app.requestedTermWeeks ?? undefined,
      firstName: app.firstName ?? undefined,
      lastName: app.lastName ?? undefined,
      ageYears: app.dateOfBirth ? ageYears(app.dateOfBirth, now) : undefined
    }),
    isc: compact({ score: app.score ?? undefined, flags: isc?.flags ?? [] }),
    config: {
      coveredProvinces: (getConfig().applications?.coveredProvinces ?? []).map(normalizeProvinceKey)
    },
    checks: { identity: {} }
  };
  if (!cedula) return { facts, cedula };

  const identity = (facts.checks as { identity: Record<string, unknown> }).identity;

  const eq = await latestReport(db, cedula, "EQUIFAX", policy.facts.equifax?.maxAgeDays, now);
  if (eq) {
    const f = eq.report.facts as unknown as EquifaxFacts;
    const scored = scoreReport(f);
    facts.equifax = {
      ...f,
      ageDays: eq.ageDays,
      ...(scored.score === null ? {} : { mikroScore: scored.score }),
      features: extractFeatures(f)
    };
    const check = identityChecks(app, f.identity);
    if (check) identity.equifax = check;
  }

  const pc = await latestReport(db, cedula, "PRESTAMOSCLOUD", policy.facts.pcloud?.maxAgeDays, now);
  if (pc) {
    const f = pc.report.facts as unknown as PcloudFacts;
    facts.pcloud = { ...f, ageDays: pc.ageDays, loans: f.lenders.flatMap((l) => l.loans) };
    const check = identityChecks(app, f.identity);
    if (check) identity.pcloud = check;
  }

  facts.mikro = await mikroHistory(db, cedula, now);
  return { facts, cedula };
}
