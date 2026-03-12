/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Query builder for the daily collections audit report.
 * Returns one row per CollectionAttempt for the given day (default: today).
 */
import {
  withErrorHandlingAndValidation,
  generateCollectionsAuditReportSchema,
  type GenerateCollectionsAuditReportInput,
  type DbClient,
  type CollectionsAuditRow
} from "@mikro/common";
import { logger } from "../../logger.js";
import type { PrismaClient } from "../../generated/prisma/client.js";

/** Start of the given date in local time (00:00:00.000). */
function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

/** End of the given date in local time = start of next day. */
function endOfDay(d: Date): Date {
  const start = startOfDay(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return end;
}

/**
 * Creates a function that returns collections audit rows for a given day.
 *
 * @param client - The database client (Prisma)
 * @returns A validated function that returns { rows: CollectionsAuditRow[] }
 */
export function createGetCollectionsAuditReport(client: DbClient) {
  const db = client as unknown as PrismaClient;

  const fn = async (
    params: GenerateCollectionsAuditReportInput
  ): Promise<{ rows: CollectionsAuditRow[] }> => {
    const auditDate = params.date ?? new Date();
    const start = startOfDay(auditDate);
    const end = endOfDay(auditDate);

    const where: Parameters<PrismaClient["collectionAttempt"]["findMany"]>[0]["where"] = {
      createdAt: { gte: start, lt: end }
    };
    if (params.attemptTypes && params.attemptTypes.length > 0) {
      where.type = { in: params.attemptTypes };
    }
    if (params.statuses && params.statuses.length > 0) {
      where.status = { in: params.statuses };
    }

    const attempts = await db.collectionAttempt.findMany({
      where,
      include: {
        customer: { select: { name: true, phone: true } },
        loan: { select: { loanId: true, nickname: true } }
      },
      orderBy: { createdAt: "asc" }
    });

    const rows: CollectionsAuditRow[] = attempts.map((a) => ({
      sentAt: new Date(a.createdAt).toISOString(),
      customerName: a.customer.name,
      customerPhone: a.customer.phone,
      loanId: a.loan.loanId,
      loanNickname: a.loan.nickname ?? "",
      attemptType: a.type,
      channel: a.channel,
      status: a.status,
      templateName: a.templateName ?? "",
      messageId: a.messageId ?? "",
      notesOrError: a.notes ?? ""
    }));

    logger.verbose("collections audit report queried", {
      date: auditDate.toISOString().slice(0, 10),
      rowCount: rows.length
    });

    return { rows };
  };

  return withErrorHandlingAndValidation(fn, generateCollectionsAuditReportSchema);
}
