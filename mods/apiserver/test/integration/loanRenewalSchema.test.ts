/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The loan_renewals table against a real database (openspec add-loan-renewal):
 * one open renewal per loan (the unique `open_key`), cancelling frees the loan,
 * and documents attach to a renewal until finalize re-points them.
 */
import { expect } from "chai";
import { createTestDb, applySchema, type TestDb } from "./setup.js";

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";

describe("loan_renewals schema", () => {
  let db: TestDb;
  let loanId: string;
  let customerId: string;

  before(async () => {
    db = createTestDb();
    await applySchema(db);
  });

  beforeEach(async () => {
    await db.customerDocument.deleteMany();
    await db.loanRenewal.deleteMany();
    await db.loan.deleteMany();
    await db.customer.deleteMany();
    await db.userRole.deleteMany();
    await db.user.deleteMany();
    await db.user.create({ data: { id: ADMIN_ID, name: "Pedro", phone: "+18095550001" } });
    const customer = await db.customer.create({
      data: {
        name: "Rosa Pérez",
        phone: "18095550003",
        idNumber: "031-0567812-4",
        homeAddress: "Calle 1",
        assignedCollectorId: ADMIN_ID
      }
    });
    customerId = customer.id;
    const loan = await db.loan.create({
      data: {
        loanId: 10034,
        principal: 10_000,
        termLength: 10,
        paymentAmount: 1_300,
        paymentFrequency: "WEEKLY",
        customerId
      }
    });
    loanId = loan.id;
  });

  after(async () => {
    await db.$disconnect();
  });

  const renewal = (over: Record<string, unknown> = {}) =>
    db.loanRenewal.create({
      data: {
        loanId,
        customerId,
        principal: 10_000,
        termLength: 10,
        paymentAmount: 1_300,
        paymentFrequency: "WEEKLY",
        createdById: ADMIN_ID,
        openKey: loanId,
        ...over
      }
    });

  it("starts as a DRAFT with nothing posted", async () => {
    const r = await renewal();
    expect(r.status).to.equal("DRAFT");
    expect(r.newLoanId).to.equal(null);
    expect(r.ledgerTransactionId).to.equal(null);
  });

  it("allows only one open renewal per loan", async () => {
    await renewal();
    let error: unknown;
    try {
      await renewal();
    } catch (e) {
      error = e;
    }
    expect(error, "second open renewal on the same loan").to.not.equal(undefined);
  });

  it("frees the loan once the renewal ends, and keeps the history", async () => {
    const first = await renewal();
    await db.loanRenewal.update({
      where: { id: first.id },
      data: { status: "CANCELLED", openKey: null, cancelledAt: new Date() }
    });
    const second = await renewal();
    const third = await renewal({ status: "COMPLETED", openKey: null });
    expect(second.status).to.equal("DRAFT");
    expect(third.openKey).to.equal(null);
    expect(await db.loanRenewal.count({ where: { loanId } })).to.equal(3);
  });

  it("links documents to the renewal and keeps them when the renewal is deleted", async () => {
    const r = await renewal();
    const doc = await db.customerDocument.create({
      data: {
        type: "CONTRACT",
        filename: "abc.pdf",
        sha256: "abc",
        source: "DIRECT",
        customerId,
        renewalId: r.id
      }
    });
    expect(
      (
        await db.loanRenewal.findUniqueOrThrow({
          where: { id: r.id },
          include: { documents: true }
        })
      ).documents
    ).to.have.length(1);
    await db.loanRenewal.delete({ where: { id: r.id } });
    const after = await db.customerDocument.findUniqueOrThrow({ where: { id: doc.id } });
    expect(after.renewalId).to.equal(null);
  });
});
