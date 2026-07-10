/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Attachment passthrough for the `loan-statement` automation (design D2, task
 * 5.2): `executeFiring`/`confirmTaskFiring` must hand the in-memory PDF back
 * to the caller while the persisted `task.completed` event stays
 * summary-only — no bytes ever reach the event log. Stubbed DB throughout
 * (no live Prisma), reusing the same stubbed-loan fixture shape as
 * `test/reports/createGenerateLoanStatement.test.ts`.
 */
import { expect } from "chai";
import sinon from "sinon";
import { executeFiring } from "../../src/tasks/firings.js";
import type { TaskFiring } from "../../src/generated/prisma/client.js";

const LOAN_START = new Date("2026-06-01T00:00:00.000Z");
const AS_OF = new Date("2026-06-15T12:00:00.000Z");
const FOUNDER_ID = "00000000-0000-4000-8000-000000000001";

function makeLoan(loanId = 10099) {
  return {
    loanId,
    principal: 4000,
    paymentAmount: 1000,
    termLength: 4,
    paymentFrequency: "WEEKLY",
    status: "ACTIVE",
    moraRate: null,
    createdAt: LOAN_START,
    startingDate: LOAN_START,
    updatedAt: AS_OF,
    nickname: null,
    customer: {
      id: "cust-1",
      name: "Cliente Prueba",
      nickname: null,
      preferredPaymentDay: null
    },
    payments: [
      {
        id: "p1",
        kind: "INSTALLMENT",
        status: "COMPLETED",
        amount: 1000,
        paidAt: new Date("2026-06-02T10:00:00Z"),
        method: "CASH",
        collectedById: "u1",
        linkedPaymentId: null,
        notes: null,
        collectedBy: { name: "Cobrador Uno" }
      }
    ]
  };
}

function makeFiring(overrides: Partial<TaskFiring> = {}): TaskFiring {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    taskId: null,
    automationId: "loan-statement",
    taskName: "Estado de cuenta del préstamo",
    gate: "confirm",
    status: "READY",
    payloadJson: JSON.stringify({}),
    missingSlotsJson: null,
    contextJson: null,
    reason: null,
    dueAt: AS_OF,
    createdAt: AS_OF,
    resolvedAt: null,
    resolvedById: null,
    ...overrides
  } as TaskFiring;
}

function makeStubDb(loanId: number) {
  const findUnique = sinon.stub().resolves(makeLoan(loanId));
  const update = sinon.stub().resolves({});
  const create = sinon.stub().resolves({ id: "event-1" });
  const db = {
    loan: { findUnique },
    taskFiring: { update },
    businessEvent: { create }
  };
  return { db, findUnique, update, create };
}

describe("executeFiring — loan-statement attachment passthrough", () => {
  afterEach(() => sinon.restore());

  it("returns the attachment (filename/mimeType/base64) alongside the summary", async () => {
    const { db } = makeStubDb(10099);
    const firing = makeFiring({ payloadJson: JSON.stringify({ loanId: 10099 }) });

    const result = await executeFiring(db as any, firing, {}, { id: FOUNDER_ID, name: "Pedro S." });

    expect(result.status).to.equal("DONE");
    expect(result.attachment).to.not.equal(undefined);
    expect(result.attachment!.filename).to.match(/^estado-cuenta-10099-.*\.pdf$/);
    expect(result.attachment!.mimeType).to.equal("application/pdf");
    expect(typeof result.attachment!.base64).to.equal("string");
    expect(result.attachment!.base64.length).to.be.greaterThan(0);
  });

  it("keeps the persisted task.completed event payload summary-only — no bytes in the log", async () => {
    const { db, create } = makeStubDb(10099);
    const firing = makeFiring({ payloadJson: JSON.stringify({ loanId: 10099 }) });

    await executeFiring(db as any, firing, {}, { id: FOUNDER_ID, name: "Pedro S." });

    expect(create.calledOnce).to.equal(true);
    const eventData = create.firstCall.args[0].data;
    expect(eventData.type).to.equal("task.completed");
    expect(eventData.payload).to.be.a("string");
    expect(eventData.payload).to.not.include("base64");
    expect(eventData).to.not.have.property("attachment");
    const parsedPayload = JSON.parse(eventData.payload);
    expect(parsedPayload).to.not.have.property("attachment");
    expect(parsedPayload.resultSummary).to.include("10099");
  });
});
