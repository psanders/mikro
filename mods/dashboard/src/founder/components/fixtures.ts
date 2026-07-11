/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Sample `FeedEvent`s for Storybook — one v1 catalog type each, plus the
 * amber policy-exception and red deletion variants. Not wired to any real
 * data; pages map tRPC output onto `FeedEvent` separately.
 */
import type { FeedEvent } from "./types";

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
}

const ROSA_ID = "11111111-1111-4111-8111-111111111111";
const CARLOS_ID = "22222222-2222-4222-8222-222222222222";

export const paymentCollectedEvent: FeedEvent = {
  id: "evt-payment-collected",
  type: "payment.collected",
  occurredAt: minutesAgo(5),
  actorId: ROSA_ID,
  actorName: "Rosa Méndez",
  customerName: "Juan Pérez",
  loanId: "loan-10001",
  loanNumber: 10001,
  amount: 2500,
  summary: "Rosa Méndez registró un pago de Juan Pérez",
  payload: { paymentId: "pay-001", method: "cash", kind: "installment" }
};

export const paymentCollectedWithLateFeeEvent: FeedEvent = {
  id: "evt-payment-collected-late-fee",
  type: "payment.collected",
  occurredAt: minutesAgo(40),
  actorId: CARLOS_ID,
  actorName: "Carlos Díaz",
  customerName: "Ana Cruz",
  loanId: "loan-10004",
  loanNumber: 10004,
  amount: 3200,
  summary: "Carlos Díaz registró un pago de Ana Cruz",
  payload: { paymentId: "pay-004", method: "transfer", kind: "installment", lateFeeAmount: 150 }
};

export const paymentReversedEvent: FeedEvent = {
  id: "evt-payment-reversed",
  type: "payment.reversed",
  occurredAt: minutesAgo(120),
  actorName: "Rosa Méndez",
  customerName: "Juan Pérez",
  loanId: "loan-10001",
  loanNumber: 10001,
  amount: 2500,
  summary: "Rosa Méndez reversó un pago de Juan Pérez",
  payload: { paymentId: "pay-001", reason: "Monto duplicado por error de captura" }
};

export const applicationApprovedEvent: FeedEvent = {
  id: "evt-application-approved",
  type: "application.approved",
  occurredAt: minutesAgo(200),
  actorName: "Miguel Torres",
  customerName: "Elena Ramírez",
  applicationId: "app-2001",
  summary: "Miguel Torres aprobó la solicitud de Elena Ramírez",
  payload: { applicationId: "app-2001", policyException: false }
};

export const applicationApprovedExceptionEvent: FeedEvent = {
  id: "evt-application-approved-exception",
  type: "application.approved",
  occurredAt: minutesAgo(15),
  actorName: "Miguel Torres",
  customerName: "Pedro Vásquez",
  applicationId: "app-2002",
  summary: "Miguel Torres aprobó la solicitud de Pedro Vásquez con excepción de política",
  payload: {
    applicationId: "app-2002",
    policyException: true,
    note: "Score bajo el mínimo; aprobado por historial de pago en préstamos anteriores"
  }
};

export const applicationRejectedEvent: FeedEvent = {
  id: "evt-application-rejected",
  type: "application.rejected",
  occurredAt: daysAgo(1),
  actorName: "Miguel Torres",
  customerName: "Luis Fernández",
  applicationId: "app-2003",
  summary: "Miguel Torres rechazó la solicitud de Luis Fernández",
  payload: { applicationId: "app-2003", note: "Ingresos no verificables" }
};

export const applicationSignedEvent: FeedEvent = {
  id: "evt-application-signed",
  type: "application.signed",
  occurredAt: daysAgo(1),
  actorName: "Elena Ramírez",
  customerName: "Elena Ramírez",
  applicationId: "app-2001",
  summary: "Elena Ramírez firmó el contrato de su solicitud",
  payload: { applicationId: "app-2001" }
};

export const applicationConvertedEvent: FeedEvent = {
  id: "evt-application-converted",
  type: "application.converted",
  occurredAt: daysAgo(1),
  actorName: "Rosa Méndez",
  customerName: "Elena Ramírez",
  loanId: "loan-10010",
  loanNumber: 10010,
  applicationId: "app-2001",
  amount: 25000,
  summary: "Rosa Méndez convirtió la solicitud de Elena Ramírez en el préstamo #10010",
  payload: { applicationId: "app-2001", loanId: "loan-10010", loanNumber: 10010, principal: 25000 }
};

export const applicationDeletedRestorableEvent: FeedEvent = {
  id: "evt-application-deleted-restorable",
  type: "application.deleted",
  occurredAt: minutesAgo(30),
  actorName: "Miguel Torres",
  customerName: "Sofía Jiménez",
  applicationId: "app-2004",
  summary: "Miguel Torres eliminó la solicitud de Sofía Jiménez",
  payload: {
    applicationId: "app-2004",
    snapshot: {
      firstName: "Sofía",
      lastName: "Jiménez",
      businessName: "Colmado La Bendición",
      requestedAmount: 15000,
      requestedTermWeeks: 12,
      province: "Santiago",
      status: "DRAFT"
    }
  }
};

export const applicationDeletedExpiredEvent: FeedEvent = {
  id: "evt-application-deleted-expired",
  type: "application.deleted",
  occurredAt: daysAgo(45),
  actorName: "Miguel Torres",
  customerName: "Hector Guzmán",
  applicationId: "app-1980",
  summary: "Miguel Torres eliminó la solicitud de Hector Guzmán",
  payload: {
    applicationId: "app-1980",
    snapshot: {
      firstName: "Hector",
      lastName: "Guzmán",
      businessName: "Salón Estrella",
      requestedAmount: 8000,
      status: "rejected"
    }
  }
};

export const applicationRestoredEvent: FeedEvent = {
  id: "evt-application-restored",
  type: "application.restored",
  occurredAt: minutesAgo(2),
  actorName: "Miguel Torres",
  customerName: "Sofía Jiménez",
  applicationId: "app-2004",
  summary: "Miguel Torres restauró la solicitud de Sofía Jiménez",
  payload: { applicationId: "app-2004", deletionEventId: "evt-application-deleted-restorable" }
};

export const loanStatusChangedEvent: FeedEvent = {
  id: "evt-loan-status-changed",
  type: "loan.status_changed",
  occurredAt: daysAgo(2),
  actorName: "Sistema",
  customerName: "Juan Pérez",
  loanId: "loan-10001",
  loanNumber: 10001,
  summary: "El préstamo #10001 de Juan Pérez cambió de estado",
  payload: { loanId: "loan-10001", from: "current", to: "overdue" }
};

/**
 * The real mapper (`loanStatusChanged` in `mods/apiserver/.../mappers.ts`)
 * always writes `from: ""` — the prior status isn't observable at the tRPC
 * boundary post-commit. This fixture exercises that degrade path (narrative
 * names only the resulting status), unlike `loanStatusChangedEvent` above.
 */
export const loanStatusChangedNoFromEvent: FeedEvent = {
  id: "evt-loan-status-changed-no-from",
  type: "loan.status_changed",
  occurredAt: daysAgo(3),
  actorName: "Sistema",
  customerName: "Ana Cruz",
  loanId: "loan-10004",
  loanNumber: 10004,
  summary: "El préstamo #10004 de Ana Cruz cambió de estado",
  payload: { loanId: "loan-10004", from: "", to: "completed" }
};

export const customerCreatedEvent: FeedEvent = {
  id: "evt-customer-created",
  type: "customer.created",
  occurredAt: daysAgo(2),
  actorName: "Rosa Méndez",
  customerName: "Karina Solís",
  summary: "Rosa Méndez creó el cliente Karina Solís",
  payload: { customerId: "cust-3001" }
};

export const copilotActionEvent: FeedEvent = {
  id: "evt-copilot-action",
  type: "copilot.action",
  occurredAt: minutesAgo(10),
  actorName: "Fundador",
  summary: "Reasignar la ruta Villa Consuelo",
  payload: {
    toolName: "reassignRoute",
    args: { routeId: "route-vc-1", newCollectorId: "user-9002" },
    resultSummary: "Ruta Villa Consuelo reasignada a Miguel Torres."
  }
};

export const ruleAlertEvent: FeedEvent = {
  id: "evt-rule-alert",
  type: "rule.alert",
  occurredAt: minutesAgo(25),
  actorName: "Sistema",
  summary: 'La regla "Mora alta" se activó: mora de la cartera = 18% (umbral > 15%).',
  payload: {
    ruleId: "rule-001",
    ruleName: "Mora alta",
    metric: "mora_pct_portfolio",
    value: 18,
    threshold: 15
  }
};

export const taskDueEvent: FeedEvent = {
  id: "evt-task-due",
  type: "task.due",
  occurredAt: minutesAgo(5),
  actorName: "Sistema",
  summary: 'La tarea "Pago semanal Ana" está lista para confirmar.',
  payload: {
    taskFiringId: "11111111-1111-4111-8111-111111111111",
    automationId: "payment",
    taskName: "Pago semanal Ana",
    dueAt: minutesAgo(5)
  }
};

export const taskNeedsInputEvent: FeedEvent = {
  id: "evt-task-needs-input",
  type: "task.needs_input",
  occurredAt: minutesAgo(8),
  actorName: "Sistema",
  summary: 'La tarea "Pago semanal Ana" necesita información: accountId.',
  payload: {
    taskFiringId: "33333333-3333-4333-8333-333333333333",
    automationId: "payment",
    taskName: "Pago semanal Ana",
    missingSlots: ["accountId"]
  }
};

export const taskCompletedEvent: FeedEvent = {
  id: "evt-task-completed",
  type: "task.completed",
  occurredAt: minutesAgo(12),
  actorName: "Pedro S.",
  amount: 3500,
  summary: "Pago de RD$3,500 a Luis M. registrado.",
  payload: {
    taskFiringId: "11111111-1111-4111-8111-111111111111",
    automationId: "payment",
    taskName: "Pago semanal Ana",
    skipped: false,
    resultSummary: "Pago de RD$3,500 a Luis M. registrado."
  }
};

export const taskFailedEvent: FeedEvent = {
  id: "evt-task-failed",
  type: "task.failed",
  occurredAt: minutesAgo(15),
  actorName: "Pedro S.",
  summary: 'La tarea "Cierre contable del día" falló: El día 2026-07-05 ya fue cerrado.',
  payload: {
    taskFiringId: "22222222-2222-4222-8222-222222222222",
    automationId: "daily-close",
    taskName: "Cierre contable del día",
    reason: "El día 2026-07-05 ya fue cerrado (transacción txn-1)."
  }
};

export const messageSentPendingEvent: FeedEvent = {
  id: "evt-message-sent-pending",
  type: "message.sent",
  occurredAt: minutesAgo(2),
  actorName: "Mikro",
  customerName: "Juan Pérez",
  summary: "Recibo enviado por WhatsApp",
  payload: {
    waMessageId: "wamid.PENDING",
    kind: "payment_confirmation",
    phone: "+18095551234",
    status: "sent"
  }
};

export const messageSentDeliveredEvent: FeedEvent = {
  id: "evt-message-sent-delivered",
  type: "message.sent",
  occurredAt: minutesAgo(18),
  actorName: "Mikro",
  customerName: "Ana Cruz",
  summary: "Recibo enviado por WhatsApp",
  payload: {
    waMessageId: "wamid.READ",
    kind: "payment_confirmation",
    phone: "+18095555678",
    status: "read"
  }
};

export const messageSentFailedEvent: FeedEvent = {
  id: "evt-message-sent-failed",
  type: "message.sent",
  occurredAt: minutesAgo(33),
  actorName: "Mikro",
  customerName: "Elena Ramírez",
  summary: "Promoción enviada por WhatsApp",
  payload: {
    waMessageId: "wamid.FAILED",
    kind: "promo",
    phone: "+18095559012",
    status: "failed",
    errorTitle: "Re-engagement message"
  }
};

/**
 * A run of five consecutive `payment.collected` events from the same actor
 * (Ana R.), newest-first — `GroupedFeedRow`'s primary specimen (issue #131).
 */
const ANA_ID = "33333333-3333-4333-8333-333333333333";
export const groupedPaymentRun: FeedEvent[] = [5, 4, 3, 2, 1].map((n, i) => ({
  id: `evt-grouped-payment-${n}`,
  type: "payment.collected",
  occurredAt: minutesAgo(60 + i * 4),
  actorId: ANA_ID,
  actorName: "Ana R.",
  customerName: `Cliente ${n}`,
  amount: 1200,
  summary: `Ana R. registró un pago de Cliente ${n}`,
  payload: { paymentId: `pay-grouped-${n}`, method: "cash", kind: "installment" }
}));

/** `FilterPopup`/`FilterBar` story actor list. */
export const feedFilterActors = [
  { id: ROSA_ID, name: "Rosa Méndez" },
  { id: CARLOS_ID, name: "Carlos Díaz" },
  { id: ANA_ID, name: "Ana R." }
];

/** All catalog specimens, in a stable order — used by the Feed composite story. */
export const allFeedEvents: FeedEvent[] = [
  messageSentPendingEvent,
  messageSentDeliveredEvent,
  messageSentFailedEvent,
  applicationApprovedExceptionEvent,
  applicationDeletedRestorableEvent,
  paymentCollectedEvent,
  applicationRestoredEvent,
  paymentCollectedWithLateFeeEvent,
  paymentReversedEvent,
  applicationApprovedEvent,
  applicationSignedEvent,
  applicationConvertedEvent,
  applicationRejectedEvent,
  loanStatusChangedEvent,
  customerCreatedEvent,
  copilotActionEvent,
  ruleAlertEvent
];
