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
  reviewNote?: string | null;
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

const applicationApproved: EventMapper = async ({ result, ctx }) => {
  const app = result as ApplicationRow;
  const actorName = await resolveActorName(db(ctx), ctx.userId);
  const name = applicationDisplayName(app);

  return {
    type: "application.approved",
    actorId: ctx.userId,
    actorName,
    customerName: name,
    applicationId: app.id,
    summary: `Solicitud de ${name} aprobada`,
    // No policy-override concept exists in the approve flow today, so this is
    // always false; the amber "exception" treatment is reserved for when it does.
    payload: {
      applicationId: app.id,
      policyException: false,
      ...(app.reviewNote ? { note: app.reviewNote } : {})
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
    payload: { applicationId: app.id, ...(app.reviewNote ? { note: app.reviewNote } : {}) }
  };
};

const applicationSigned: EventMapper = async ({ result, ctx }) => {
  const app = result as ApplicationRow;
  const actorName = await resolveActorName(db(ctx), ctx.userId);
  const name = applicationDisplayName(app);

  return {
    type: "application.signed",
    actorId: ctx.userId,
    actorName,
    customerName: name,
    applicationId: app.id,
    summary: `Contrato firmado para la solicitud de ${name}`,
    payload: { applicationId: app.id }
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
 * Registry keyed by event type. Every catalog type has a mapper EXCEPT
 * `application.restored`, which createRestoreApplication writes itself.
 */
export const eventMappers: Partial<Record<BusinessEventType, EventMapper>> = {
  "payment.collected": paymentCollected,
  "payment.reversed": paymentReversed,
  "application.approved": applicationApproved,
  "application.rejected": applicationRejected,
  "application.signed": applicationSigned,
  "application.converted": applicationConverted,
  "application.deleted": applicationDeleted,
  "loan.status_changed": loanStatusChanged,
  "customer.created": customerCreated
};
