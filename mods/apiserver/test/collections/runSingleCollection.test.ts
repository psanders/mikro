/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { runSingleCollection } from "../../src/collections/runSingleCollection.js";
import { CollectionChannel, CollectionAttemptType } from "../../src/generated/prisma/enums.js";

describe("runSingleCollection", () => {
  const loanId = 10019;
  const loanUuid = "loan-uuid-10019";
  const memberId = "member-uuid-1";
  const activeLoanWithMember = {
    id: loanUuid,
    loanId,
    status: "ACTIVE",
    paymentFrequency: "WEEKLY",
    principal: 5000,
    termLength: 8,
    paymentAmount: 650,
    createdAt: new Date("2025-01-01"),
    member: {
      id: memberId,
      name: "Maria Garcia",
      phone: "+18091234567",
      preferredPaymentDay: "MONDAY"
    },
    payments: [
      { paidAt: new Date("2026-01-06") },
      { paidAt: new Date("2026-01-13") }
    ]
  };

  let mockDb: {
    loan: { findUnique: sinon.SinonStub };
    collectionAttempt: { create: sinon.SinonStub };
  };
  let sendWhatsAppTemplate: sinon.SinonStub;

  beforeEach(() => {
    mockDb = {
      loan: { findUnique: sinon.stub().resolves(activeLoanWithMember) },
      collectionAttempt: { create: sinon.stub().resolves({ id: "attempt-1" }) }
    };
    sendWhatsAppTemplate = sinon.stub().resolves({ messages: [{ id: "msg-1" }] });
  });

  afterEach(() => {
    sinon.restore();
  });

  it("returns error when loan not found", async () => {
    mockDb.loan.findUnique.resolves(null);
    const result = await runSingleCollection(
      { loanId },
      { db: mockDb as any, sendWhatsAppTemplate }
    );
    expect(result.success).to.be.false;
    expect(result.error).to.include("Loan not found");
    expect(sendWhatsAppTemplate.called).to.be.false;
    expect(mockDb.collectionAttempt.create.called).to.be.false;
  });

  it("returns error when loan is not ACTIVE", async () => {
    mockDb.loan.findUnique.resolves({ ...activeLoanWithMember, status: "COMPLETED" });
    const result = await runSingleCollection(
      { loanId, type: CollectionAttemptType.PAYMENT_REMINDER },
      { db: mockDb as any, sendWhatsAppTemplate }
    );
    expect(result.success).to.be.false;
    expect(result.error).to.include("Loan not found");
  });

  it("dry-run returns success without sending or writing DB", async () => {
    const result = await runSingleCollection(
      { loanId, type: CollectionAttemptType.PAYMENT_REMINDER, dryRun: true },
      { db: mockDb as any, sendWhatsAppTemplate }
    );
    expect(result.success).to.be.true;
    expect(result.dryRun).to.be.true;
    expect(result.memberName).to.equal("Maria Garcia");
    expect(sendWhatsAppTemplate.called).to.be.false;
    expect(mockDb.collectionAttempt.create.called).to.be.false;
  });

  it("force type PAYMENT_REMINDER sends WhatsApp and records attempt", async () => {
    const result = await runSingleCollection(
      { loanId, type: CollectionAttemptType.PAYMENT_REMINDER },
      { db: mockDb as any, sendWhatsAppTemplate }
    );
    expect(result.success).to.be.true;
    expect(result.type).to.equal(CollectionAttemptType.PAYMENT_REMINDER);
    expect(result.channel).to.equal(CollectionChannel.WHATSAPP);
    expect(result.memberName).to.equal("Maria Garcia");
    expect(sendWhatsAppTemplate.calledOnce).to.be.true;
    expect(mockDb.collectionAttempt.create.calledOnce).to.be.true;
    const createCall = mockDb.collectionAttempt.create.getCall(0);
    expect(createCall.args[0].data.type).to.equal(CollectionAttemptType.PAYMENT_REMINDER);
    expect(createCall.args[0].data.channel).to.equal(CollectionChannel.WHATSAPP);
    expect(createCall.args[0].data.memberId).to.equal(memberId);
    expect(createCall.args[0].data.loanId).to.equal(loanUuid);
  });

  it("force type OVERDUE_NOTICE sends WhatsApp and records attempt", async () => {
    const result = await runSingleCollection(
      { loanId, type: CollectionAttemptType.OVERDUE_NOTICE },
      { db: mockDb as any, sendWhatsAppTemplate }
    );
    expect(result.success).to.be.true;
    expect(result.type).to.equal(CollectionAttemptType.OVERDUE_NOTICE);
    expect(result.channel).to.equal(CollectionChannel.WHATSAPP);
    expect(sendWhatsAppTemplate.calledOnce).to.be.true;
    expect(mockDb.collectionAttempt.create.calledOnce).to.be.true;
  });

  it("force channel and type uses overrides", async () => {
    const result = await runSingleCollection(
      {
        loanId,
        type: CollectionAttemptType.PAYMENT_REMINDER,
        channel: CollectionChannel.WHATSAPP
      },
      { db: mockDb as any, sendWhatsAppTemplate }
    );
    expect(result.channel).to.equal(CollectionChannel.WHATSAPP);
    expect(result.type).to.equal(CollectionAttemptType.PAYMENT_REMINDER);
  });

  it("COLLECTION_CALL does not call sendWhatsAppTemplate", async () => {
    const result = await runSingleCollection(
      { loanId, type: CollectionAttemptType.COLLECTION_CALL },
      { db: mockDb as any, sendWhatsAppTemplate }
    );
    expect(result.success).to.be.true;
    expect(result.type).to.equal(CollectionAttemptType.COLLECTION_CALL);
    expect(result.channel).to.equal(CollectionChannel.PHONE_CALL);
    expect(sendWhatsAppTemplate.called).to.be.false;
    expect(mockDb.collectionAttempt.create.calledOnce).to.be.true;
  });

  it("force channel WHATSAPP for COLLECTION_CALL type still records attempt", async () => {
    const result = await runSingleCollection(
      {
        loanId,
        type: CollectionAttemptType.COLLECTION_CALL,
        channel: CollectionChannel.WHATSAPP
      },
      { db: mockDb as any, sendWhatsAppTemplate }
    );
    expect(result.channel).to.equal(CollectionChannel.WHATSAPP);
    expect(mockDb.collectionAttempt.create.calledOnce).to.be.true;
    expect(mockDb.collectionAttempt.create.getCall(0).args[0].data.channel).to.equal(
      CollectionChannel.WHATSAPP
    );
  });

  it("records FAILED attempt when sendWhatsAppTemplate throws", async () => {
    sendWhatsAppTemplate.rejects(new Error("WhatsApp API error"));
    const result = await runSingleCollection(
      { loanId, type: CollectionAttemptType.PAYMENT_REMINDER },
      { db: mockDb as any, sendWhatsAppTemplate }
    );
    expect(result.success).to.be.false;
    expect(mockDb.collectionAttempt.create.calledOnce).to.be.true;
    expect(mockDb.collectionAttempt.create.getCall(0).args[0].data.status).to.equal("FAILED");
    expect(mockDb.collectionAttempt.create.getCall(0).args[0].data.notes).to.include(
      "WhatsApp API error"
    );
  });
});
