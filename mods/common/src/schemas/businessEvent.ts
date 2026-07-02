/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";

/**
 * v1 business event catalog. The event log is append-only: corrections are
 * new events (e.g. payment.reversed), never updates or deletes.
 */
export const businessEventTypeEnum = z.enum([
  "payment.collected",
  "payment.reversed",
  "application.approved",
  "application.rejected",
  "application.signed",
  "application.converted",
  "application.deleted",
  "application.restored",
  "loan.status_changed",
  "customer.created"
]);

export type BusinessEventType = z.infer<typeof businessEventTypeEnum>;

const paymentCollectedPayloadSchema = z.object({
  paymentId: z.uuid(),
  method: z.string(),
  kind: z.string(),
  lateFeeAmount: z.number().optional()
});

const paymentReversedPayloadSchema = z.object({
  paymentId: z.uuid(),
  reason: z.string().optional()
});

const applicationApprovedPayloadSchema = z.object({
  applicationId: z.uuid(),
  // True when the approval overrode a policy rule; feed renders these
  // with the exception (amber) treatment.
  policyException: z.boolean(),
  note: z.string().optional()
});

const applicationRejectedPayloadSchema = z.object({
  applicationId: z.uuid(),
  note: z.string().optional()
});

const applicationSignedPayloadSchema = z.object({
  applicationId: z.uuid()
});

const applicationConvertedPayloadSchema = z.object({
  applicationId: z.uuid(),
  loanId: z.uuid(),
  loanNumber: z.number().int().optional(),
  principal: z.number().optional()
});

const applicationDeletedPayloadSchema = z.object({
  applicationId: z.uuid(),
  // Full row snapshot at deletion time — the source restoreApplication
  // re-creates from. Kept loose on purpose: the model may gain columns.
  snapshot: z.record(z.string(), z.unknown())
});

const applicationRestoredPayloadSchema = z.object({
  applicationId: z.uuid(),
  deletionEventId: z.uuid()
});

const loanStatusChangedPayloadSchema = z.object({
  loanId: z.uuid(),
  from: z.string(),
  to: z.string()
});

const customerCreatedPayloadSchema = z.object({
  customerId: z.uuid()
});

/** Per-type payload schema. Producers MUST validate through this map. */
export const businessEventPayloadSchemas: Record<BusinessEventType, z.ZodType> = {
  "payment.collected": paymentCollectedPayloadSchema,
  "payment.reversed": paymentReversedPayloadSchema,
  "application.approved": applicationApprovedPayloadSchema,
  "application.rejected": applicationRejectedPayloadSchema,
  "application.signed": applicationSignedPayloadSchema,
  "application.converted": applicationConvertedPayloadSchema,
  "application.deleted": applicationDeletedPayloadSchema,
  "application.restored": applicationRestoredPayloadSchema,
  "loan.status_changed": loanStatusChangedPayloadSchema,
  "customer.created": customerCreatedPayloadSchema
};

/**
 * Input for the recordEvent writer. `payload` is additionally validated
 * against businessEventPayloadSchemas[type] before persisting.
 */
export const recordBusinessEventSchema = z.object({
  type: businessEventTypeEnum,
  actorId: z.uuid().optional(),
  actorName: z.string().min(1),
  customerId: z.uuid().optional(),
  customerName: z.string().optional(),
  loanId: z.uuid().optional(),
  applicationId: z.uuid().optional(),
  amount: z.number().optional(),
  summary: z.string().min(1),
  payload: z.record(z.string(), z.unknown())
});

export type RecordBusinessEventInput = z.infer<typeof recordBusinessEventSchema>;

/**
 * Feed query. Cursor pagination over (occurredAt, id) — a deliberate
 * exception to the repo's offset/limit convention: the feed grows at the
 * head, and offsets would skip/duplicate rows between pages.
 */
export const listFeedEventsSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().positive().max(100).optional(),
  types: z.array(businessEventTypeEnum).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional()
});

export const restoreApplicationSchema = z.object({
  // The application.deleted event to restore from.
  deletionEventId: z.uuid()
});

export const searchAllSchema = z.object({
  query: z.string().trim().min(1),
  limitPerGroup: z.number().int().positive().max(20).optional()
});

export const exportAuditLogSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12)
});

/** Days after deletion during which restoreApplication is permitted. */
export const RESTORE_WINDOW_DAYS = 30;
