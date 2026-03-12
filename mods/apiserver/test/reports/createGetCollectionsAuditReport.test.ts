/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Unit tests for createGetCollectionsAuditReport: date filtering, row shape, error notes.
 */
import { expect } from "chai";
import sinon from "sinon";

describe("createGetCollectionsAuditReport", () => {
  let createGetCollectionsAuditReport: (client: unknown) => (params: {
    date?: Date;
    attemptTypes?: string[];
    statuses?: string[];
  }) => Promise<{
    rows: Array<{
      sentAt: string;
      customerName: string;
      customerPhone: string;
      loanId: number;
      loanNickname: string;
      attemptType: string;
      channel: string;
      status: string;
      templateName: string;
      messageId: string;
      notesOrError: string;
    }>;
  }>;

  before(async () => {
    const mod = await import("../../src/api/reports/createGetCollectionsAuditReport.js");
    createGetCollectionsAuditReport = mod.createGetCollectionsAuditReport;
  });

  afterEach(() => {
    sinon.restore();
  });

  it("should query collectionAttempt with createdAt gte start of day and lt end of day", async () => {
    const findMany = sinon.stub().resolves([]);
    const mockDb = {
      collectionAttempt: {
        findMany
      }
    };
    const fn = createGetCollectionsAuditReport(mockDb);
    const auditDate = new Date("2026-03-12T14:00:00Z");

    await fn({ date: auditDate });

    expect(findMany.calledOnce).to.be.true;
    const call = findMany.getCall(0);
    const where = call.args[0].where;
    expect(where.createdAt).to.exist;
    expect(where.createdAt.gte).to.be.instanceOf(Date);
    expect(where.createdAt.lt).to.be.instanceOf(Date);
    const gte = where.createdAt.gte as Date;
    const lt = where.createdAt.lt as Date;
    expect(lt.getTime()).to.be.greaterThan(gte.getTime());
    expect(call.args[0].orderBy).to.deep.equal({ createdAt: "asc" });
  });

  it("should include customer and loan in the query", async () => {
    const findMany = sinon.stub().resolves([]);
    const mockDb = { collectionAttempt: { findMany } };
    const fn = createGetCollectionsAuditReport(mockDb);

    await fn({});

    const include = findMany.getCall(0).args[0].include;
    expect(include.customer).to.deep.equal({ select: { name: true, phone: true } });
    expect(include.loan).to.deep.equal({ select: { loanId: true, nickname: true } });
  });

  it("should return rows with joined customer and loan and notesOrError from notes", async () => {
    const attempts = [
      {
        createdAt: new Date("2026-03-12T10:02:00Z"),
        type: "OVERDUE_NOTICE",
        channel: "WHATSAPP",
        status: "FAILED",
        templateName: "payment_overdue",
        messageId: null,
        notes: "Fonoster timeout",
        customer: { name: "Ana Rodríguez", phone: "+18095550333" },
        loan: { loanId: 10047, nickname: null }
      }
    ];
    const findMany = sinon.stub().resolves(attempts);
    const mockDb = { collectionAttempt: { findMany } };
    const fn = createGetCollectionsAuditReport(mockDb);

    const { rows } = await fn({ date: new Date("2026-03-12") });

    expect(rows).to.have.length(1);
    expect(rows[0].sentAt).to.equal("2026-03-12T10:02:00.000Z");
    expect(rows[0].customerName).to.equal("Ana Rodríguez");
    expect(rows[0].customerPhone).to.equal("+18095550333");
    expect(rows[0].loanId).to.equal(10047);
    expect(rows[0].loanNickname).to.equal("");
    expect(rows[0].attemptType).to.equal("OVERDUE_NOTICE");
    expect(rows[0].channel).to.equal("WHATSAPP");
    expect(rows[0].status).to.equal("FAILED");
    expect(rows[0].templateName).to.equal("payment_overdue");
    expect(rows[0].messageId).to.equal("");
    expect(rows[0].notesOrError).to.equal("Fonoster timeout");
  });

  it("should apply attemptTypes filter when provided", async () => {
    const findMany = sinon.stub().resolves([]);
    const mockDb = { collectionAttempt: { findMany } };
    const fn = createGetCollectionsAuditReport(mockDb);

    await fn({ attemptTypes: ["OVERDUE_NOTICE", "COLLECTION_CALL"] });

    const where = findMany.getCall(0).args[0].where;
    expect(where.type).to.deep.equal({ in: ["OVERDUE_NOTICE", "COLLECTION_CALL"] });
  });

  it("should apply statuses filter when provided", async () => {
    const findMany = sinon.stub().resolves([]);
    const mockDb = { collectionAttempt: { findMany } };
    const fn = createGetCollectionsAuditReport(mockDb);

    await fn({ statuses: ["FAILED"] });

    const where = findMany.getCall(0).args[0].where;
    expect(where.status).to.deep.equal({ in: ["FAILED"] });
  });

  it("should throw ValidationError for invalid input", async () => {
    const mockDb = { collectionAttempt: { findMany: sinon.stub().resolves([]) } };
    const fn = createGetCollectionsAuditReport(mockDb);

    try {
      await fn({ attemptTypes: ["INVALID"] } as { attemptTypes?: string[] });
      expect.fail("Expected ValidationError");
    } catch (err: unknown) {
      const e = err as Error;
      expect(e.name).to.equal("ValidationError");
    }
  });
});
