/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Integration tests for loan note procedures.
 */
import { expect } from "chai";
import {
  createTestDb,
  createAuthenticatedCaller,
  applySchema,
  type TestDb,
  type AuthenticatedCaller
} from "./setup.js";

describe("Loan Notes Integration", () => {
  let db: TestDb;
  let caller: AuthenticatedCaller;

  before(async () => {
    db = createTestDb();
    await applySchema(db);
  });

  beforeEach(async () => {
    await db.loanNote.deleteMany();
    await db.payment.deleteMany();
    await db.loan.deleteMany();
    await db.message.deleteMany();
    await db.customer.deleteMany();
    await db.userRole.deleteMany();
    await db.user.deleteMany();
    caller = createAuthenticatedCaller(db);
  });

  after(async () => {
    await db.$disconnect();
  });

  async function createUserWithRole(role: "COLLECTOR" | "REFERRER", suffix: string) {
    return caller.createUser({
      name: `Test ${role} ${suffix}`,
      phone: `+1809${Date.now().toString().slice(-7)}${suffix}`,
      role
    });
  }

  async function createCustomerWithDefaultedLoan() {
    const collector = await createUserWithRole("COLLECTOR", "c");
    const referrer = await createUserWithRole("REFERRER", "r");

    const customer = await caller.createCustomer({
      name: "Defaulted Customer",
      phone: "+18091234500",
      idNumber: `001-${Date.now().toString().slice(-7)}-9`,
      collectionPoint: "https://example.com/test",
      homeAddress: "Test Address",
      referredById: referrer.id,
      assignedCollectorId: collector.id
    });

    const loan = await caller.createLoan({
      customerId: customer.id,
      principal: 5000,
      termLength: 10,
      paymentAmount: 650,
      paymentFrequency: "WEEKLY"
    });

    await caller.updateLoanStatus({ loanId: loan.loanId, status: "DEFAULTED" });

    return { customer, loan, collector, referrer };
  }

  describe("createLoanNote", () => {
    it("should create a note linked to loan and user", async () => {
      const { loan, collector } = await createCustomerWithDefaultedLoan();

      const note = await caller.createLoanNote({
        loanId: loan.loanId,
        content: "Called customer, no answer",
        createdById: collector.id
      });

      expect(note.id).to.be.a("string");
      expect(note.content).to.equal("Called customer, no answer");
      expect(note.createdBy).to.be.a("string").with.length.greaterThan(0);
    });

    it("should store multiple notes for the same loan", async () => {
      const { loan, collector, referrer } = await createCustomerWithDefaultedLoan();

      await caller.createLoanNote({
        loanId: loan.loanId,
        content: "First contact attempt",
        createdById: collector.id
      });

      await caller.createLoanNote({
        loanId: loan.loanId,
        content: "Customer promised Friday payment",
        createdById: referrer.id
      });

      const notes = await caller.listLoanNotesByLoan({ loanId: loan.loanId });
      expect(notes).to.have.lengthOf(2);
    });
  });

  describe("listLoanNotesByLoan", () => {
    it("should return notes ordered by createdAt desc", async () => {
      const { loan, collector } = await createCustomerWithDefaultedLoan();

      const first = await caller.createLoanNote({
        loanId: loan.loanId,
        content: "First note",
        createdById: collector.id
      });

      // Back-date the first note so ordering is deterministic
      await db.loanNote.update({
        where: { id: first.id },
        data: { createdAt: new Date(Date.now() - 60_000) }
      });

      await caller.createLoanNote({
        loanId: loan.loanId,
        content: "Second note",
        createdById: collector.id
      });

      const notes = await caller.listLoanNotesByLoan({ loanId: loan.loanId });

      expect(notes).to.have.lengthOf(2);
      expect(notes[0].content).to.equal("Second note");
      expect(notes[1].content).to.equal("First note");
    });

    it("should return empty array for loan with no notes", async () => {
      const { loan } = await createCustomerWithDefaultedLoan();

      const notes = await caller.listLoanNotesByLoan({ loanId: loan.loanId });

      expect(notes).to.be.an("array").with.lengthOf(0);
    });

    it("should not return notes from other loans", async () => {
      const { loan: loan1, collector } = await createCustomerWithDefaultedLoan();

      const customer2 = await caller.createCustomer({
        name: "Other Customer",
        phone: "+18091234501",
        idNumber: "001-9999999-1",
        collectionPoint: "https://example.com/other",
        homeAddress: "Other Address",
        referredById: (await createUserWithRole("REFERRER", "r2")).id,
        assignedCollectorId: collector.id
      });

      const loan2 = await caller.createLoan({
        customerId: customer2.id,
        principal: 3000,
        termLength: 5,
        paymentAmount: 700,
        paymentFrequency: "WEEKLY"
      });

      await caller.createLoanNote({
        loanId: loan1.loanId,
        content: "Note for loan 1",
        createdById: collector.id
      });

      await caller.createLoanNote({
        loanId: loan2.loanId,
        content: "Note for loan 2",
        createdById: collector.id
      });

      const notes1 = await caller.listLoanNotesByLoan({ loanId: loan1.loanId });
      const notes2 = await caller.listLoanNotesByLoan({ loanId: loan2.loanId });

      expect(notes1).to.have.lengthOf(1);
      expect(notes1[0].content).to.equal("Note for loan 1");
      expect(notes2).to.have.lengthOf(1);
      expect(notes2[0].content).to.equal("Note for loan 2");
    });

    it("should include the creator name in each note", async () => {
      const { loan, collector } = await createCustomerWithDefaultedLoan();

      await caller.createLoanNote({
        loanId: loan.loanId,
        content: "Test note",
        createdById: collector.id
      });

      const notes = await caller.listLoanNotesByLoan({ loanId: loan.loanId });

      expect(notes[0].createdBy).to.include("COLLECTOR");
    });
  });
});
