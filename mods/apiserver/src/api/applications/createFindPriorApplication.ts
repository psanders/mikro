/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * One application per person (issue #302). Before a new application is
 * submitted, look for the same person's other applications — matched by phone
 * OR cédula, since people re-apply with another number — and decide what the
 * submission may do:
 *
 * - `in_process`: they already have one being handled (RECEIVED → APPROVED).
 *   No second application; they follow up on WhatsApp.
 * - `cooldown`: they were rejected less than REAPPLY_COOLDOWN_DAYS ago, for
 *   any reason (out of coverage area included). No new application until
 *   `reapplyFrom`.
 * - `draft`: they left an unsubmitted DRAFT under another session. The new
 *   answers go into that one, so the person keeps one application.
 */
import { REAPPLY_COOLDOWN_DAYS } from "@mikro/common";
import type { PrismaClient } from "../../generated/prisma/client.js";

export { REAPPLY_COOLDOWN_DAYS };
const DAY_MS = 24 * 60 * 60 * 1000;

/** Statuses of an application someone is still handling. */
const IN_PROCESS = ["RECEIVED", "IN_REVIEW", "PENDING_DECISION", "APPROVED"] as const;

export type PriorApplication =
  | { kind: "in_process"; applicationId: string; sessionId: string; status: string }
  | { kind: "cooldown"; applicationId: string; reapplyFrom: Date; rejectionReason: string | null }
  | { kind: "draft"; applicationId: string; sessionId: string };

export interface PriorApplicationQuery {
  /** E.164, as normalizeApplication stores it. */
  phone?: string | null;
  idNumber?: string | null;
  /**
   * The session being submitted. Its own row never counts as "in process" or
   * as another draft (a repeated final submit must go through), but a
   * rejection under it still starts the cooldown.
   */
  sessionId: string;
  now?: Date;
}

/** "037-0105842-6" and "03701058426" are the same cédula. */
function cedulaVariants(idNumber: string | null | undefined): string[] {
  const digits = (idNumber ?? "").replace(/\D/g, "");
  if (digits.length !== 11) return [];
  return [digits, `${digits.slice(0, 3)}-${digits.slice(3, 10)}-${digits.slice(10)}`];
}

/** When a rejected application's cooldown ends. */
export function reapplyDateOf(rejectedAt: Date): Date {
  return new Date(rejectedAt.getTime() + REAPPLY_COOLDOWN_DAYS * DAY_MS);
}

export function createFindPriorApplication(client: Pick<PrismaClient, "loanApplication">) {
  return async (query: PriorApplicationQuery): Promise<PriorApplication | null> => {
    const who = [
      ...(query.phone ? [{ phone: query.phone }] : []),
      ...cedulaVariants(query.idNumber).map((idNumber) => ({ idNumber }))
    ];
    if (who.length === 0) return null;

    const mine = await client.loanApplication.findMany({
      where: { OR: [...who, { sessionId: query.sessionId }] },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        sessionId: true,
        status: true,
        decidedAt: true,
        submittedAt: true,
        updatedAt: true,
        rejectionReason: true
      }
    });

    const others = mine.filter((a) => a.sessionId !== query.sessionId);
    const inProcess = others.find((a) => (IN_PROCESS as readonly string[]).includes(a.status));
    if (inProcess) {
      return {
        kind: "in_process",
        applicationId: inProcess.id,
        sessionId: inProcess.sessionId,
        status: inProcess.status
      };
    }

    const now = (query.now ?? new Date()).getTime();
    for (const app of mine) {
      if (app.status !== "REJECTED") continue;
      const rejectedAt = app.decidedAt ?? app.submittedAt ?? app.updatedAt;
      const reapplyFrom = reapplyDateOf(rejectedAt);
      if (reapplyFrom.getTime() > now) {
        return {
          kind: "cooldown",
          applicationId: app.id,
          reapplyFrom,
          rejectionReason: app.rejectionReason ?? null
        };
      }
    }

    const draft = others.find((a) => a.status === "DRAFT");
    return draft ? { kind: "draft", applicationId: draft.id, sessionId: draft.sessionId } : null;
  };
}

export type FindPriorApplication = ReturnType<typeof createFindPriorApplication>;
