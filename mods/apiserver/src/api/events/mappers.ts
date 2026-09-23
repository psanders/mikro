/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Central registry of business-event mappers (design Decision 1 & 5). One mapper
 * per v1 catalog type turns a successful mutation's `(input, result, ctx)` into a
 * `RecordBusinessEventInput`: the actor and Spanish summary, denormalized names
 * fetched via `ctx.db`, amounts, and a typed payload. The event-capture
 * middleware in `src/trpc/trpc.ts` runs the matching mapper after the resolver
 * commits. `application.restored` is deliberately absent — it is written
 * intrinsically by `createRestoreApplication`, so it must never be double-written
 * here.
 */
import type { RecordBusinessEventInput, BusinessEventType } from "@mikro/common";
import { amountToNumber } from "@mikro/common";
import type { Context } from "../../trpc/context.js";
import type { EventClient } from "./recordEvent.js";
import {
  resolveActorName,
  applicationDisplayName,
  formatDop,
  toJsonSafeSnapshot
} from "./helpers.js";

export interface EventMapperArgs {
  /** Raw procedure input (unparsed). Mappers cast the fields they need. */
  input: unknown;
  /** The resolver's successful return value. */
  result: unknown;
  /** Request context — actor id + a db client for denormalization lookups. */
  ctx: Context;
}

/** Produces the event to record, or null to skip recording. */
export type EventMapper = (args: EventMapperArgs) => Promise<RecordBusinessEventInput | null>;

/** The Prisma-capable client behind the hand-written DbClient abstraction. */
function db(ctx: Context): EventClient {
  return ctx.db as unknown as EventClient;
}

/** Spanish labels for the loan statuses updateLoanStatus can set. */
const LOAN_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "activo",
  COMPLETED: "completado",
  DEFAULTED: "en mora",
  CANCELLED: "cancelado"
};

interface PaymentRow {
  id: string;
  amount: number;
  method: string;
  kind: string;
  loanId: string;
}

interface ApplicationRow {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  businessName?: string | null;
  score?: number | null;
  assignedReviewerId?: string | null;
  reviewerRecommendation?: string | null;
  decisionNote?: string | null;
  rejectionReason?: string | null;
  approvedAmount?: unknown;
  approvedTermWeeks?: number | null;
}

/** Display data every application review event carries (see applicationEventBase). */
function applicationBase(app: ApplicationRow) {
  return {
    applicationId: app.id,
    ...(app.businessName ? { businessName: app.businessName } : {}),
    ...(app.score != null ? { score: app.score } : {})
  };
}

async function loanCustomer(client: EventClient, loanUuid: string) {
  return client.loan.findUnique({
    where: { id: loanUuid },
    select: { customerId: true, customer: { select: { name: true } } }
  });
}

const paymentCollected: EventMapper = async ({ input, result, ctx }) => {
  const r = result as { installment: PaymentRow | null; lateFee: PaymentRow | null };
  const primary = r.installment ?? r.lateFee;
  if (!primary) return null;

  const total = (r.installment?.amount ?? 0) + (r.lateFee?.amount ?? 0);
  // The collector who recorded the payment is the actor (may differ from the
  // authenticated caller, e.g. back-office capture).
  const collectorId = (input as { collectedById?: string } | undefined)?.collectedById;
  const client = db(ctx);
  const loan = await loanCustomer(client, primary.loanId);
  const actorName = await resolveActorName(client, collectorId);
  const customerName = loan?.customer?.name ?? undefined;

  return {
    type: "payment.collected",
    actorId: collectorId,
    actorName,
    customerId: loan?.customerId ?? undefined,
    customerName,
    loanId: primary.loanId,
    amount: total,
    summary: `${actorName} cobró ${formatDop(total)}${customerName ? ` a ${customerName}` : ""}`,
    payload: {
      paymentId: primary.id,
      method: primary.method,
      kind: primary.kind,
      ...(r.lateFee ? { lateFeeAmount: r.lateFee.amount } : {})
    }
  };
};

const paymentReversed: EventMapper = async ({ input, result, ctx }) => {
  const p = result as { id: string; amount: number; loanId: string };
  const client = db(ctx);
  const loan = await loanCustomer(client, p.loanId);
  const actorName = await resolveActorName(client, ctx.userId);
  const reason = (input as { notes?: string } | undefined)?.notes;
  const customerName = loan?.customer?.name ?? undefined;

  return {
    type: "payment.reversed",
    actorId: ctx.userId,
    actorName,
    customerId: loan?.customerId ?? undefined,
    customerName,
    loanId: p.loanId,
    amount: p.amount,
    summary: `${actorName} revirtió un pago de ${formatDop(p.amount)}${customerName ? ` de ${customerName}` : ""}`,
    payload: { paymentId: p.id, ...(reason ? { reason } : {}) }
  };
};

const applicationAssigned: EventMapper = async ({ input, result, ctx }) => {
  const app = result as ApplicationRow;
  const client = db(ctx);
  const actorName = await resolveActorName(client, ctx.userId);
  const assigneeId = app.assignedReviewerId ?? ctx.userId;
  const self = assigneeId === ctx.userId;
  const assigneeName = self ? actorName : await resolveActorName(client, assigneeId);
  const name = applicationDisplayName(app);
  // An assigneeId in the input on an application that was already in review
  // means an admin moved it; either way the payload names who holds it now.
  const reassigned = Boolean((input as { assigneeId?: string } | undefined)?.assigneeId) && !self;

  return {
    type: "application.assigned",
    actorId: ctx.userId,
    actorName,
    customerName: name,
    applicationId: app.id,
    summary: self
      ? `${actorName} tomó la solicitud de ${name}`
      : `${actorName} asignó la solicitud de ${name} a ${assigneeName}`,
    payload: {
      ...applicationBase(app),
      assigneeId,
      assigneeName,
      ...(reassigned ? { reassigned } : {})
    }
  };
};

const applicationSentToDecision: EventMapper = async ({ result, ctx }) => {
  const app = result as ApplicationRow;
  const actorName = await resolveActorName(db(ctx), ctx.userId);
  const name = applicationDisplayName(app);

  return {
    type: "application.sent_to_decision",
    actorId: ctx.userId,
    actorName,
    customerName: name,
    applicationId: app.id,
    summary: `${actorName} envió a decisión la solicitud de ${name}`,
    payload: {
      ...applicationBase(app),
      ...(app.reviewerRecommendation ? { recommendation: app.reviewerRecommendation } : {})
    }
  };
};

const applicationReturned: EventMapper = async ({ result, ctx }) => {
  const app = result as ApplicationRow;
  const actorName = await resolveActorName(db(ctx), ctx.userId);
  const name = applicationDisplayName(app);

  return {
    type: "application.returned",
    actorId: ctx.userId,
    actorName,
    customerName: name,
    applicationId: app.id,
    summary: `${actorName} devolvió la solicitud de ${name} al evaluador`,
    payload: { ...applicationBase(app), note: app.decisionNote ?? "" }
  };
};

const applicationApproved: EventMapper = async ({ result, ctx }) => {
  const app = result as ApplicationRow;
  const actorName = await resolveActorName(db(ctx), ctx.userId);
  const name = applicationDisplayName(app);
  const approvedAmount =
    app.approvedAmount != null ? amountToNumber(app.approvedAmount as number) : undefined;

  return {
    type: "application.approved",
    actorId: ctx.userId,
    actorName,
    customerName: name,
    applicationId: app.id,
    amount: approvedAmount,
    summary: `Solicitud de ${name} aprobada${approvedAmount != null ? ` por ${formatDop(approvedAmount)}` : ""}`,
    // No policy-override concept exists in the approve flow today, so this is
    // always false; the amber "exception" treatment is reserved for when it does.
    payload: {
      ...applicationBase(app),
      policyException: false,
      ...(approvedAmount != null ? { approvedAmount } : {}),
      ...(app.approvedTermWeeks != null ? { approvedTermWeeks: app.approvedTermWeeks } : {}),
      ...(app.decisionNote ? { note: app.decisionNote } : {})
    }
  };
};

const applicationRejected: EventMapper = async ({ result, ctx }) => {
  const app = result as ApplicationRow;
  const actorName = await resolveActorName(db(ctx), ctx.userId);
  const name = applicationDisplayName(app);

  return {
    type: "application.rejected",
    actorId: ctx.userId,
    actorName,
    customerName: name,
    applicationId: app.id,
    summary: `Solicitud de ${name} rechazada`,
    payload: {
      ...applicationBase(app),
      ...(app.rejectionReason ? { reason: app.rejectionReason } : {}),
      ...(app.decisionNote ? { note: app.decisionNote } : {})
    }
  };
};

const applicationWithdrawn: EventMapper = async ({ result, ctx }) => {
  const app = result as ApplicationRow;
  const actorName = await resolveActorName(db(ctx), ctx.userId);
  const name = applicationDisplayName(app);

  return {
    type: "application.withdrawn",
    actorId: ctx.userId,
    actorName,
    customerName: name,
    applicationId: app.id,
    summary: `${name} desistió del préstamo aprobado`,
    payload: applicationBase(app)
  };
};

const applicationConverted: EventMapper = async ({ result, ctx }) => {
  const r = result as {
    application: ApplicationRow;
    customerId: string;
    loanId: number;
    reusedCustomer: boolean;
    // mikro/#155: set when the disbursement was auto-posted in the same
    // transaction as the conversion — folded into this single card rather
    // than a second event, since the log has no cross-event grouping.
    disbursement?: {
      transactionId: string;
      accountId: string;
      accountName: string;
      amount: number;
    };
  };
  const client = db(ctx);
  const actorName = await resolveActorName(client, ctx.userId);
  const loan = await client.loan.findUnique({
    where: { loanId: r.loanId },
    select: { id: true, principal: true }
  });
  const customer = await client.customer.findUnique({
    where: { id: r.customerId },
    select: { name: true }
  });
  const name = customer?.name ?? applicationDisplayName(r.application);
  const principal = loan ? amountToNumber(loan.principal) : undefined;
  const disbursementSummary = r.disbursement
    ? ` — RD$${r.disbursement.amount.toLocaleString("es-DO")} desembolsados desde ${r.disbursement.accountName}`
    : "";

  return {
    type: "application.converted",
    actorId: ctx.userId,
    actorName,
    customerId: r.customerId,
    customerName: name,
    loanId: loan?.id,
    applicationId: r.application.id,
    amount: principal,
    summary: `Solicitud de ${name} convertida en préstamo #${r.loanId}${disbursementSummary}`,
    payload: {
      applicationId: r.application.id,
      // The loan was just created in the convert transaction, so it always
      // exists; fall back to the application id only to satisfy the uuid schema.
      loanId: loan?.id ?? r.application.id,
      loanNumber: r.loanId,
      ...(principal != null ? { principal } : {}),
      ...(r.disbursement
        ? {
            disbursementAccountName: r.disbursement.accountName,
            disbursementTransactionId: r.disbursement.transactionId
          }
        : {})
    }
  };
};

const applicationDeleted: EventMapper = async ({ result, ctx }) => {
  const app = result as ApplicationRow & Record<string, unknown>;
  const actorName = await resolveActorName(db(ctx), ctx.userId);
  const name = applicationDisplayName(app);
  const applicationId = String(app.id);

  return {
    type: "application.deleted",
    actorId: ctx.userId,
    actorName,
    customerName: name,
    applicationId,
    summary: `Solicitud de ${name} eliminada`,
    // Full JSON-safe snapshot so restoreApplication can re-create the row.
    payload: { applicationId, snapshot: toJsonSafeSnapshot(app as Record<string, unknown>) }
  };
};

const loanStatusChanged: EventMapper = async ({ result, ctx }) => {
  const r = result as { id: string; loanId: number; status: string };
  const client = db(ctx);
  const loan = await loanCustomer(client, r.id);
  const actorName = await resolveActorName(client, ctx.userId);
  const customerName = loan?.customer?.name ?? undefined;
  const label = LOAN_STATUS_LABELS[r.status] ?? r.status;

  return {
    type: "loan.status_changed",
    actorId: ctx.userId,
    actorName,
    customerId: loan?.customerId ?? undefined,
    customerName,
    loanId: r.id,
    summary: `Préstamo #${r.loanId} marcado como ${label}`,
    // `from` (the prior status) is not observable at the tRPC boundary after the
    // mutation commits — capturing it would require editing the mutation function
    // (out of scope) or a pre-resolver hook (not in the capture contract). Empty
    // string means "unknown"; `to` is authoritative.
    payload: { loanId: r.id, from: "", to: r.status }
  };
};

/** Spanish plural adverbs for a loan's payment frequency, matching the dashboard's FREQUENCY_ADVERBS. */
const FREQUENCY_ADVERBS: Record<string, string> = {
  DAILY: "diarias",
  WEEKLY: "semanales",
  BIWEEKLY: "quincenales",
  MONTHLY: "mensuales"
};

interface CreateLoanInput {
  customerId: string;
  principal: number;
  termLength: number;
  paymentAmount: number;
  paymentFrequency: "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
}

interface CreatedLoanRow {
  id: string;
  loanId: number;
  customerId: string;
}

/**
 * A loan created directly (not via application conversion) — e.g. the
 * founder copilot's "Nuevo préstamo" form. This is the single event for that
 * action: if the founder also opted to generate a contract, that's implied by
 * the loan and does NOT get its own event (the retired `contract.generated`
 * added only noise).
 */
const loanCreated: EventMapper = async ({ input, result, ctx }) => {
  const i = input as CreateLoanInput;
  const loan = result as CreatedLoanRow;
  const client = db(ctx);
  const actorName = await resolveActorName(client, ctx.userId);
  const customer = await client.customer.findUnique({
    where: { id: i.customerId },
    select: { name: true }
  });
  const name = customer?.name ?? "un cliente";
  const adverb = FREQUENCY_ADVERBS[i.paymentFrequency] ?? "";

  return {
    type: "loan.created",
    actorId: ctx.userId,
    actorName,
    customerId: i.customerId,
    customerName: name,
    loanId: loan.id,
    amount: i.principal,
    summary: `${actorName} creó un préstamo de ${formatDop(i.principal)} a ${i.termLength} cuota${i.termLength === 1 ? "" : "s"}${adverb ? ` ${adverb}` : ""} para ${name}`,
    payload: {
      loanId: loan.id,
      principal: i.principal,
      installments: i.termLength,
      frequency: i.paymentFrequency,
      installmentAmount: i.paymentAmount
    }
  };
};

const customerCreated: EventMapper = async ({ result, ctx }) => {
  const c = result as { id: string; name: string };
  const actorName = await resolveActorName(db(ctx), ctx.userId);

  return {
    type: "customer.created",
    actorId: ctx.userId,
    actorName,
    customerId: c.id,
    customerName: c.name,
    summary: `${actorName} registró al cliente ${c.name}`,
    payload: { customerId: c.id }
  };
};

/**
 * Registry keyed by event type. Every catalog type has a mapper EXCEPT the ones
 * not written at the tRPC boundary: `application.received` (intake/promote write
 * it, see recordApplicationReceived), the retired `application.signed`,
 * `application.restored` (createRestoreApplication writes it) and `contract.generated` (RETIRED — a contract is created as part of
 * a loan, so `loan.created` covers it; the standalone event was redundant noise.
 * Kept in the catalog only so historical rows still read/render).
 */
export const eventMappers: Partial<Record<BusinessEventType, EventMapper>> = {
  "payment.collected": paymentCollected,
  "payment.reversed": paymentReversed,
  "application.assigned": applicationAssigned,
  "application.sent_to_decision": applicationSentToDecision,
  "application.returned": applicationReturned,
  "application.approved": applicationApproved,
  "application.rejected": applicationRejected,
  "application.withdrawn": applicationWithdrawn,
  "application.converted": applicationConverted,
  "application.deleted": applicationDeleted,
  "loan.created": loanCreated,
  "loan.status_changed": loanStatusChanged,
  "customer.created": customerCreated
};
