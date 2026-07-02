/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";
import { restoreApplicationSchema, RESTORE_WINDOW_DAYS } from "@mikro/common";
import { TRPCError } from "@trpc/server";
import type { EventClient } from "./recordEvent.js";
import { recordEvent } from "./recordEvent.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { resolveActorName, applicationDisplayName, snapshotToCreateData } from "./helpers.js";

type RestoreApplicationInput = z.infer<typeof restoreApplicationSchema>;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RestoreApplicationResult {
  id: string;
  status: string;
}

/**
 * Re-create a hard-deleted loan application from the JSON snapshot stored on its
 * `application.deleted` event, and record an `application.restored` event —
 * both in one transaction. Permitted only within RESTORE_WINDOW_DAYS of the
 * deletion. Validates before writing: missing/wrong-type event, expired window,
 * an id already in use, or a taken unique `sessionId` each fail with a
 * structured error and no partial writes.
 */
export function createRestoreApplication(client: EventClient, actorId?: string) {
  return async (rawInput: RestoreApplicationInput): Promise<RestoreApplicationResult> => {
    const input = restoreApplicationSchema.parse(rawInput);

    const event = await client.businessEvent.findUnique({
      where: { id: input.deletionEventId }
    });
    if (!event) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Deletion event not found." });
    }
    if (event.type !== "application.deleted") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Event is not an application deletion and cannot be restored."
      });
    }

    const ageMs = Date.now() - new Date(event.occurredAt).getTime();
    if (ageMs > RESTORE_WINDOW_DAYS * DAY_MS) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Restore window of ${RESTORE_WINDOW_DAYS} days has expired for this application.`
      });
    }

    const parsed = JSON.parse(event.payload) as {
      applicationId: string;
      snapshot: Record<string, unknown>;
    };
    const snapshot = parsed.snapshot;
    const applicationId = String(snapshot.id ?? parsed.applicationId);
    const sessionId = snapshot.sessionId as string | undefined;

    // Conflict checks before any write.
    const existing = await client.loanApplication.findUnique({ where: { id: applicationId } });
    if (existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "An application with this id already exists; nothing to restore."
      });
    }
    if (sessionId) {
      const sessionTaken = await client.loanApplication.findFirst({ where: { sessionId } });
      if (sessionTaken) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "The application's sessionId is already in use; cannot restore."
        });
      }
    }

    const createData = snapshotToCreateData(
      snapshot
    ) as unknown as Prisma.LoanApplicationUncheckedCreateInput;

    const name = applicationDisplayName({
      id: applicationId,
      firstName: snapshot.firstName as string | null | undefined,
      lastName: snapshot.lastName as string | null | undefined,
      businessName: snapshot.businessName as string | null | undefined
    });

    const restored = await client.$transaction(async (tx) => {
      const row = await tx.loanApplication.create({ data: createData });
      const actorName = await resolveActorName(tx, actorId);
      await recordEvent(tx, {
        type: "application.restored",
        actorId,
        actorName,
        customerName: name,
        applicationId,
        summary: `Solicitud de ${name} restaurada`,
        payload: { applicationId, deletionEventId: input.deletionEventId }
      });
      return row;
    });

    return { id: restored.id, status: restored.status };
  };
}
