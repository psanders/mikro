/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Integration tests for `collectorSync`. Covers mikro/#73: the offline
 * snapshot it returns feeds the mobile app's local cache, which the
 * evaluator screens (cliente/[id], prestamo/[loanId]) also read from — so a
 * REVIEWER-only caller must not receive payment history in this response,
 * even though the endpoint itself only requires authentication.
 */
import { expect } from "chai";
import { createTestDb, applySchema, type TestDb } from "./setup.js";
import { appRouter } from "../../src/trpc/index.js";

describe("collectorSync Integration", () => {
  let db: TestDb;
  let phoneSeq = 0;
  const uniqueNanpPhone = () => {
    phoneSeq += 1;
    return `+1809${String(10_000_000 + phoneSeq).slice(1)}`;
  };

  const callerWithRoles = (roles: ("ADMIN" | "COLLECTOR" | "REVIEWER")[]) =>
    appRouter.createCaller({
      db: db as any,
      isAuthenticated: true,
      userId: "33333333-3333-4333-8333-333333333333",
      roles
    });

  before(async () => {
    db = createTestDb();
    await applySchema(db);
  });

  beforeEach(async () => {
    await db.loanNote.deleteMany();
    await db.payment.deleteMany();
    await db.loan.deleteMany();
    await db.customer.deleteMany();
    await db.userRole.deleteMany();
    await db.user.deleteMany();
  });

  after(async () => {
    await db.$disconnect();
  });

  async function seedLoanWithPayment() {
    const admin = callerWithRoles(["ADMIN"]);
    const collector = await admin.createUser({
      name: "Test Collector",
      phone: uniqueNanpPhone(),
      role: "COLLECTOR"
    });
    const customer = await admin.createCustomer({
      name: "Sync Test Customer",
      phone: uniqueNanpPhone(),
      idNumber: `001-${String(Date.now()).slice(-7)}-9`,
      collectionPoint: "https://example.com/test-point",
      homeAddress: "Test Address",
      assignedCollectorId: collector.id
    });
    const loan = await admin.createLoan({
      customerId: customer.id,
      principal: 5000,
      termLength: 10,
      paymentAmount: 650,
      paymentFrequency: "WEEKLY"
    });
    await admin.createPayment({
      loanId: loan.loanId,
      amount: 650,
      paidAt: new Date("2026-01-05"),
      collectedById: collector.id
    });
    return loan;
  }

  it("includes payment history for COLLECTOR and ADMIN callers", async () => {
    const loan = await seedLoanWithPayment();

    for (const roles of [["COLLECTOR"], ["ADMIN"]] as const) {
      const result = await callerWithRoles([...roles]).collectorSync();
      const synced = result.loans.find((l) => l.loanId === loan.loanId);
      expect(synced, `loan missing for roles ${roles.join(",")}`).to.not.equal(undefined);
      expect(synced!.payments).to.have.lengthOf(1);
    }
  });

  it("strips payment history for REVIEWER-only callers", async () => {
    const loan = await seedLoanWithPayment();

    const result = await callerWithRoles(["REVIEWER"]).collectorSync();
    const synced = result.loans.find((l) => l.loanId === loan.loanId);

    expect(synced, "loan should still sync (terms are not payment data)").to.not.equal(undefined);
    expect(synced!.payments).to.have.lengthOf(0);
    // Loan terms (non-payment data) still sync so the evaluator flow keeps working.
    expect(synced!.principal).to.equal(5000);
    expect(synced!.status).to.equal("ACTIVE");
  });
});
