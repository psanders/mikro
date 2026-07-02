/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  ValidationError,
  recordBusinessEventSchema,
  businessEventPayloadSchemas,
  type RecordBusinessEventInput
} from "@mikro/common";
import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

/**
 * Any client that can write a BusinessEvent row — the full PrismaClient or an
 * interactive transaction client. Producers ALWAYS pass their transaction `tx`
 * so the event and its mutation commit (or roll back) together.
 */
export type EventClient = PrismaClient | Prisma.TransactionClient;

/**
 * Append a business event to the log. Validates the envelope against
 * `recordBusinessEventSchema` AND the `payload` against the per-type schema in
 * `businessEventPayloadSchemas`, then persists the row with the payload
 * serialized to a JSON string. Throws the repo's structured `ValidationError`
 * (no row written) on any validation failure.
 *
 * There is intentionally no update or delete counterpart: the log is
 * append-only, and corrections are recorded as new events.
 */
export async function recordEvent(
  client: EventClient,
  input: RecordBusinessEventInput
): Promise<{ id: string }> {
  const envelope = recordBusinessEventSchema.safeParse(input);
  if (!envelope.success) {
    throw new ValidationError(envelope.error);
  }

  const payloadSchema = businessEventPayloadSchemas[envelope.data.type];
  const payload = payloadSchema.safeParse(envelope.data.payload);
  if (!payload.success) {
    throw new ValidationError(payload.error);
  }

  const data = envelope.data;
  const created = await client.businessEvent.create({
    data: {
      type: data.type,
      actorId: data.actorId ?? null,
      actorName: data.actorName,
      customerId: data.customerId ?? null,
      customerName: data.customerName ?? null,
      loanId: data.loanId ?? null,
      applicationId: data.applicationId ?? null,
      amount: data.amount ?? null,
      summary: data.summary,
      payload: JSON.stringify(payload.data)
    },
    select: { id: true }
  });

  return created;
}
