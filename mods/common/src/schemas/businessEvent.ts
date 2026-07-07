/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";
import { outboundMessageStatusEnum } from "./whatsapp.js";

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
  "customer.created",
  "copilot.action",
  "rule.alert",
  "task.due",
  "task.needs_input",
  "task.completed",
  "task.failed",
  "qcobro.synced",
  "message.sent"
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

// Written intrinsically by the copilot confirm flow (not an annotated procedure).
const copilotActionPayloadSchema = z.object({
  toolName: z.string(),
  args: z.record(z.string(), z.unknown()),
  resultSummary: z.string().optional()
});

// Written intrinsically by the watch-rule evaluator on a state change.
const ruleAlertPayloadSchema = z.object({
  ruleId: z.uuid(),
  ruleName: z.string(),
  metric: z.string(),
  value: z.number(),
  threshold: z.number()
});

// Task lifecycle events, written intrinsically by the task worker and the
// firing confirm/skip flow. They carry the firing/automation refs plus the
// task name denormalized — like every event, no foreign keys, so the row
// stays renderable after its task is edited or deleted.
const taskEventBase = z.object({
  taskFiringId: z.uuid(),
  automationId: z.string().min(1),
  taskName: z.string().min(1)
});

const taskDuePayloadSchema = taskEventBase.extend({
  // The period's intended due time (ISO), which may be earlier than
  // occurredAt when the firing fired late after downtime.
  dueAt: z.iso.datetime()
});

const taskNeedsInputPayloadSchema = taskEventBase.extend({
  missingSlots: z.array(z.string()).min(1),
  reason: z.string().optional()
});

const taskCompletedPayloadSchema = taskEventBase.extend({
  // True when the founder skipped the firing instead of executing it.
  skipped: z.boolean(),
  resultSummary: z.string().optional()
});

const taskFailedPayloadSchema = taskEventBase.extend({
  reason: z.string().min(1)
});

// Written intrinsically by the QCobro cron worker after each full-base
// sync pass (issue #127) — never by the on-payment resync, which would
// flood the feed with one card per payment.
const qcobroSyncedPayloadSchema = z.object({
  customers: z.number().int().nonnegative(),
  portfoliosPushed: z.number().int().nonnegative(),
  portfoliosSkipped: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative()
});

// A business-initiated WhatsApp send (promo, payment confirmation, reminder,
// overdue). Emitted ONCE at send time; `status` here is the initial value.
// Live delivery state lives in the mutable `outbound_messages` row (keyed by
// `waMessageId`) and is overlaid onto this payload at feed-read time — the
// event log itself stays append-only.
const messageSentPayloadSchema = z.object({
  waMessageId: z.string().min(1),
  kind: z.string().min(1),
  phone: z.string().min(1),
  status: outboundMessageStatusEnum
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
  "customer.created": customerCreatedPayloadSchema,
  "copilot.action": copilotActionPayloadSchema,
  "rule.alert": ruleAlertPayloadSchema,
  "task.due": taskDuePayloadSchema,
  "task.needs_input": taskNeedsInputPayloadSchema,
  "task.completed": taskCompletedPayloadSchema,
  "task.failed": taskFailedPayloadSchema,
  "qcobro.synced": qcobroSyncedPayloadSchema,
  "message.sent": messageSentPayloadSchema
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
