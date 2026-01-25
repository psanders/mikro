/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Integration tests for payment procedures.
 * Tests happy paths for payment creation and listing.
 */
import { expect } from "chai";
import {
  createTestDb,
  createAuthenticatedCaller,
  applySchema,
  type TestDb,
  type AuthenticatedCaller
} from "./setup.js";

describe("Payments Integration", () => {
  let db: TestDb;
  let caller: AuthenticatedCaller;

  before(async () => {
    db = createTestDb();
    await applySchema(db);
  });

  beforeEach(async () => {
    // Clean tables between tests (order matters due to foreign keys)
    await db.payment.deleteMany();
    await db.loan.deleteMany();
    await db.message.deleteMany();
    await db.member.deleteMany();
    await db.userRole.deleteMany();
    await db.user.deleteMany();
    caller = createAuthenticatedCaller(db);
  });

  after(async () => {
    await db.$disconnect();
  });

  /**
   * Helper to create a member with a loan for payment tests.
   */
  async function createMemberWithLoan(options?: { referredById?: string; memberName?: string }) {
    const member = await caller.createMember({
      name: options?.memberName ?? "Payment Test Member",
      phone: "+18091234591",
      idNumber: `001-${String(Date.now()).slice(-7)}-9`,
      collectionPoint: "https://example.com/test-point",
      homeAddress: "Test Address",
      referredById:
        options?.referredById ??
        (
          await caller.createUser({
            name: "Test Referrer",
            phone: "+18091234581",
            role: "REFERRER"
          })
        ).id,
      assignedCollectorId: (
        await caller.createUser({
          name: "Test Collector",
          phone: "+18091234582",
          role: "COLLECTOR"
        })
      ).id
    });

    const loan = await caller.createLoan({
      memberId: member.id,
      principal: 5000,
      termLength: 10,
      paymentAmount: 650,
      paymentFrequency: "WEEKLY"
    });

    return { member, loan };
  }

  describe("createPayment", () => {
    it("should create a payment with required fields", async () => {
      const { loan } = await createMemberWithLoan();

      const payment = await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650
      });

      expect(payment.id).to.be.a("string");
      expect(payment.loanId).to.equal(loan.id); // Payment stores UUID
      expect(Number(payment.amount)).to.equal(650);
      expect(payment.status).to.equal("COMPLETED");
      expect(payment.method).to.equal("CASH"); // Default method
    });

    it("should create a payment with CASH method", async () => {
      const { loan } = await createMemberWithLoan();

      const payment = await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650,
        method: "CASH"
      });

      expect(payment.method).to.equal("CASH");
    });

    it("should create a payment with TRANSFER method", async () => {
      const { loan } = await createMemberWithLoan();

      const payment = await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650,
        method: "TRANSFER"
      });

      expect(payment.method).to.equal("TRANSFER");
    });

    it("should create a payment with custom paidAt date", async () => {
      const { loan } = await createMemberWithLoan();
      const customDate = new Date("2026-01-15T10:00:00Z");

      const payment = await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650,
        paidAt: customDate
      });

      const paidAt = new Date(payment.paidAt);
      expect(paidAt.toISOString()).to.equal(customDate.toISOString());
    });

    it("should create a payment with collector", async () => {
      const collector = await caller.createUser({
        name: "Test Collector",
        phone: "+18091234591",
        role: "COLLECTOR"
      });
      const { loan } = await createMemberWithLoan();

      const payment = await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650,
        collectedById: collector.id
      });

      expect(payment.collectedById).to.equal(collector.id);
    });

    it("should create a payment with notes", async () => {
      const { loan } = await createMemberWithLoan();

      const payment = await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650,
        notes: "Partial payment for week 3"
      });

      expect(payment.notes).to.equal("Partial payment for week 3");
    });

    it("should create multiple payments for same loan", async () => {
      const { loan } = await createMemberWithLoan();

      const payment1 = await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650
      });

      const payment2 = await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650
      });

      const payment3 = await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650
      });

      expect(payment1.id).to.not.equal(payment2.id);
      expect(payment2.id).to.not.equal(payment3.id);
    });
  });

  describe("listPayments", () => {
    it("should list payments within date range", async () => {
      const { loan } = await createMemberWithLoan();

      // Create payments on different dates
      await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650,
        paidAt: new Date("2026-01-10")
      });
      await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650,
        paidAt: new Date("2026-01-15")
      });
      await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650,
        paidAt: new Date("2026-01-20")
      });

      const payments = await caller.listPayments({
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31")
      });

      expect(payments).to.be.an("array");
      expect(payments).to.have.lengthOf(3);
    });

    it("should filter payments by date range", async () => {
      const { loan } = await createMemberWithLoan();

      // Create payments on different dates
      await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650,
        paidAt: new Date("2026-01-05")
      });
      await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650,
        paidAt: new Date("2026-01-15")
      });
      await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650,
        paidAt: new Date("2026-02-05")
      });

      const payments = await caller.listPayments({
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-01-31")
      });

      expect(payments).to.have.lengthOf(1);
    });

    it("should return payments in descending order by paidAt", async () => {
      const { loan } = await createMemberWithLoan();

      await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 100,
        paidAt: new Date("2026-01-10")
      });
      await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 200,
        paidAt: new Date("2026-01-20")
      });
      await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 300,
        paidAt: new Date("2026-01-15")
      });

      const payments = await caller.listPayments({
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31")
      });

      // Should be ordered: Jan 20, Jan 15, Jan 10
      expect(Number(payments[0].amount)).to.equal(200);
      expect(Number(payments[1].amount)).to.equal(300);
      expect(Number(payments[2].amount)).to.equal(100);
    });

    it("should respect limit parameter", async () => {
      const { loan } = await createMemberWithLoan();

      for (let i = 0; i < 5; i++) {
        await caller.createPayment({
          loanId: loan.loanId, // Use numeric loanId
          amount: 650,
          paidAt: new Date(`2026-01-${10 + i}`)
        });
      }

      const payments = await caller.listPayments({
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31"),
        limit: 3
      });

      expect(payments).to.have.lengthOf(3);
    });

    it("should return empty array when no payments in range", async () => {
      const { loan } = await createMemberWithLoan();

      await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650,
        paidAt: new Date("2026-01-15")
      });

      const payments = await caller.listPayments({
        startDate: new Date("2026-02-01"),
        endDate: new Date("2026-02-28")
      });

      expect(payments).to.be.an("array");
      expect(payments).to.have.lengthOf(0);
    });
  });

  describe("listPaymentsByMember", () => {
    it("should list payments for a specific member", async () => {
      const { member, loan } = await createMemberWithLoan({ memberName: "Member A" });
      const { loan: otherLoan } = await createMemberWithLoan({ memberName: "Member B" });

      // Create payments for both members
      await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650,
        paidAt: new Date("2026-01-15")
      });
      await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650,
        paidAt: new Date("2026-01-20")
      });
      await caller.createPayment({
        loanId: otherLoan.loanId, // Use numeric loanId
        amount: 650,
        paidAt: new Date("2026-01-15")
      });

      const payments = await caller.listPaymentsByMember({
        memberId: member.id,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31")
      });

      expect(payments).to.have.lengthOf(2);
    });

    it("should filter by date range for member", async () => {
      const { member, loan } = await createMemberWithLoan();

      await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650,
        paidAt: new Date("2026-01-05")
      });
      await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650,
        paidAt: new Date("2026-01-15")
      });
      await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650,
        paidAt: new Date("2026-02-05")
      });

      const payments = await caller.listPaymentsByMember({
        memberId: member.id,
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-01-31")
      });

      expect(payments).to.have.lengthOf(1);
    });

    it("should return empty array for member with no payments", async () => {
      const { member } = await createMemberWithLoan();

      const payments = await caller.listPaymentsByMember({
        memberId: member.id,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31")
      });

      expect(payments).to.be.an("array");
      expect(payments).to.have.lengthOf(0);
    });
  });

  describe("listPaymentsByReferrer", () => {
    it("should list payments for members referred by a specific user", async () => {
      // Create referrers
      const referrer1 = await caller.createUser({
        name: "Referrer 1",
        phone: "+18091234592",
        role: "REFERRER"
      });
      const referrer2 = await caller.createUser({
        name: "Referrer 2",
        phone: "+18091234593",
        role: "REFERRER"
      });

      // Create members with different referrers
      const { loan: loan1 } = await createMemberWithLoan({
        memberName: "Referred by 1 - A",
        referredById: referrer1.id
      });
      const { loan: loan2 } = await createMemberWithLoan({
        memberName: "Referred by 1 - B",
        referredById: referrer1.id
      });
      const { loan: loan3 } = await createMemberWithLoan({
        memberName: "Referred by 2",
        referredById: referrer2.id
      });

      // Create payments
      await caller.createPayment({
        loanId: loan1.loanId, // Use numeric loanId
        amount: 650,
        paidAt: new Date("2026-01-15")
      });
      await caller.createPayment({
        loanId: loan2.loanId, // Use numeric loanId
        amount: 650,
        paidAt: new Date("2026-01-16")
      });
      await caller.createPayment({
        loanId: loan3.loanId, // Use numeric loanId
        amount: 650,
        paidAt: new Date("2026-01-17")
      });

      const payments = await caller.listPaymentsByReferrer({
        referredById: referrer1.id,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31")
      });

      expect(payments).to.have.lengthOf(2);
    });

    it("should filter by date range for referrer", async () => {
      const referrer = await caller.createUser({
        name: "Test Referrer",
        phone: "+18091234594",
        role: "REFERRER"
      });
      const { loan } = await createMemberWithLoan({ referredById: referrer.id });

      await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650,
        paidAt: new Date("2026-01-05")
      });
      await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650,
        paidAt: new Date("2026-01-15")
      });
      await caller.createPayment({
        loanId: loan.loanId, // Use numeric loanId
        amount: 650,
        paidAt: new Date("2026-02-05")
      });

      const payments = await caller.listPaymentsByReferrer({
        referredById: referrer.id,
        startDate: new Date("2026-01-10"),
        endDate: new Date("2026-01-31")
      });

      expect(payments).to.have.lengthOf(1);
    });

    it("should return empty array for referrer with no referred members", async () => {
      const referrer = await caller.createUser({
        name: "Empty Referrer",
        phone: "+18091234595",
        role: "REFERRER"
      });

      const payments = await caller.listPaymentsByReferrer({
        referredById: referrer.id,
        startDate: new Date("2026-01-01"),
        endDate: new Date("2026-01-31")
      });

      expect(payments).to.be.an("array");
      expect(payments).to.have.lengthOf(0);
    });
  });
});
