/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Integration tests for loan procedures.
 * Tests happy paths for loan creation with auto-incrementing loanId.
 */
import { expect } from "chai";
import {
  createTestDb,
  createAuthenticatedCaller,
  applySchema,
  type TestDb,
  type AuthenticatedCaller,
} from "./setup.js";

describe("Loans Integration", () => {
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
   * Helper to create a member for loan tests.
   */
  async function createTestMember() {
    return caller.createMember({
      name: "Loan Test Member",
      phone: "+1234567890",
      idNumber: "ID-LOAN-TEST",
      collectionPoint: "Test Point",
      homeAddress: "Test Address",
    });
  }

  describe("createLoan", () => {
    it("should create a loan with required fields", async () => {
      const member = await createTestMember();

      const input = {
        memberId: member.id,
        principal: 5000,
        termLength: 10,
        paymentAmount: 650,
        paymentFrequency: "WEEKLY" as const,
      };

      const loan = await caller.createLoan(input);

      expect(loan.id).to.be.a("string");
      expect(loan.memberId).to.equal(member.id);
      expect(Number(loan.principal)).to.equal(input.principal);
      expect(loan.termLength).to.equal(input.termLength);
      expect(Number(loan.paymentAmount)).to.equal(input.paymentAmount);
      expect(loan.paymentFrequency).to.equal(input.paymentFrequency);
      expect(loan.status).to.equal("ACTIVE");
      expect(loan.type).to.equal("SAN"); // Default type
    });

    it("should create a loan with DAILY payment frequency", async () => {
      const member = await createTestMember();

      const loan = await caller.createLoan({
        memberId: member.id,
        principal: 3000,
        termLength: 30,
        paymentAmount: 120,
        paymentFrequency: "DAILY",
      });

      expect(loan.paymentFrequency).to.equal("DAILY");
    });

    it("should create a loan with explicit SAN type", async () => {
      const member = await createTestMember();

      const loan = await caller.createLoan({
        memberId: member.id,
        principal: 10000,
        termLength: 20,
        paymentAmount: 600,
        paymentFrequency: "WEEKLY",
        type: "SAN",
      });

      expect(loan.type).to.equal("SAN");
    });

    it("should start loanId at 10000 for first loan", async () => {
      const member = await createTestMember();

      const loan = await caller.createLoan({
        memberId: member.id,
        principal: 5000,
        termLength: 10,
        paymentAmount: 650,
        paymentFrequency: "WEEKLY",
      });

      expect(loan.loanId).to.equal(10000);
    });

    it("should auto-increment loanId for subsequent loans", async () => {
      const member = await createTestMember();

      // Create first loan
      const loan1 = await caller.createLoan({
        memberId: member.id,
        principal: 5000,
        termLength: 10,
        paymentAmount: 650,
        paymentFrequency: "WEEKLY",
      });

      // Create second loan
      const loan2 = await caller.createLoan({
        memberId: member.id,
        principal: 3000,
        termLength: 5,
        paymentAmount: 700,
        paymentFrequency: "WEEKLY",
      });

      // Create third loan
      const loan3 = await caller.createLoan({
        memberId: member.id,
        principal: 10000,
        termLength: 20,
        paymentAmount: 600,
        paymentFrequency: "DAILY",
      });

      expect(loan1.loanId).to.equal(10000);
      expect(loan2.loanId).to.equal(10001);
      expect(loan3.loanId).to.equal(10002);
    });

    it("should create loans for different members with unique loanIds", async () => {
      // Create multiple members
      const member1 = await caller.createMember({
        name: "Member One",
        phone: "+1111111111",
        idNumber: "ID-M1",
        collectionPoint: "Point 1",
        homeAddress: "Address 1",
      });

      const member2 = await caller.createMember({
        name: "Member Two",
        phone: "+2222222222",
        idNumber: "ID-M2",
        collectionPoint: "Point 2",
        homeAddress: "Address 2",
      });

      // Create loans for different members
      const loan1 = await caller.createLoan({
        memberId: member1.id,
        principal: 5000,
        termLength: 10,
        paymentAmount: 650,
        paymentFrequency: "WEEKLY",
      });

      const loan2 = await caller.createLoan({
        memberId: member2.id,
        principal: 3000,
        termLength: 5,
        paymentAmount: 700,
        paymentFrequency: "DAILY",
      });

      expect(loan1.memberId).to.equal(member1.id);
      expect(loan2.memberId).to.equal(member2.id);
      expect(loan1.loanId).to.equal(10000);
      expect(loan2.loanId).to.equal(10001);
    });

    it("should set createdAt to current time", async () => {
      const member = await createTestMember();
      const beforeCreate = new Date();

      const loan = await caller.createLoan({
        memberId: member.id,
        principal: 5000,
        termLength: 10,
        paymentAmount: 650,
        paymentFrequency: "WEEKLY",
      });

      const afterCreate = new Date();
      const createdAt = new Date(loan.createdAt);

      expect(createdAt.getTime()).to.be.at.least(beforeCreate.getTime() - 1000);
      expect(createdAt.getTime()).to.be.at.most(afterCreate.getTime() + 1000);
    });
  });
});
