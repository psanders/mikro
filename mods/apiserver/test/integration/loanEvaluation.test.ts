/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Integration tests for the collections evaluation framework's tRPC surface:
 * getLoanEvaluationSnapshot, getLoanHealth, and runPortfolioHealthCheck. These
 * exercise the real router against a real (in-memory) database, proving the
 * wiring — schema validation, procedure registration, auth gating, and the
 * copilot dependency seam for getLoanHealth's `explain` narration — actually
 * works end to end. The apiserver unit tests for these endpoints stub the
 * Prisma client directly and don't prove any of that.
 */
import { expect } from "chai";
import { TRPCError } from "@trpc/server";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import type { ToolExecutor } from "@mikro/agents";
import {
  createTestDb,
  createAuthenticatedCaller,
  createUnauthenticatedCaller,
  applySchema,
  type TestDb,
  type AuthenticatedCaller
} from "./setup.js";
import { setCopilotDeps, clearCopilotDeps } from "../../src/api/copilot/index.js";

describe("Loan Evaluation Framework Integration", () => {
  let db: TestDb;
  let caller: AuthenticatedCaller;
  /** Monotonic suffix so user/customer phones stay unique across tests. */
  let phoneSeq = 0;
  const uniqueNanpPhone = () => {
    phoneSeq += 1;
    return `+1809${String(10_000_000 + phoneSeq).slice(1)}`;
  };

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
    clearCopilotDeps();
  });

  afterEach(() => {
    clearCopilotDeps();
  });

  after(async () => {
    await db.$disconnect();
  });

  /** WEEKLY loan, cuota 1000, term 4 — small numbers, easy to hand-verify. */
  async function createCustomerWithLoan(startingDate: Date) {
    const collector = await caller.createUser({
      name: "Eval Test Collector",
      phone: uniqueNanpPhone(),
      role: "COLLECTOR"
    });
    const customer = await caller.createCustomer({
      name: "Eval Test Customer",
      phone: uniqueNanpPhone(),
      idNumber: `001-${String(Date.now()).slice(-7)}-9`,
      collectionPoint: "https://example.com/test-point",
      homeAddress: "Test Address",
      assignedCollectorId: collector.id
    });
    const loan = await caller.createLoan({
      customerId: customer.id,
      principal: 4000,
      termLength: 4,
      paymentAmount: 1000,
      paymentFrequency: "WEEKLY",
      startingDate
    });
    return { customer, loan, collector };
  }

  // Anchored at "now" so no cycle is missed yet — mora stays at zero and every
  // payment applies cleanly to the installment (createPayment mora-first
  // splitting would otherwise consume the payment as a late fee).
  const FRESH_START = () => new Date();

  describe("getLoanEvaluationSnapshot", () => {
    it("returns terms + full raw ledger (incl. reversed) + money-based derived numbers", async () => {
      const { loan, collector } = await createCustomerWithLoan(FRESH_START());

      await caller.createPayment({
        loanId: loan.loanId,
        amount: 1000,
        collectedById: collector.id
      });
      const second = await caller.createPayment({
        loanId: loan.loanId,
        amount: 1000,
        collectedById: collector.id
      });
      await caller.reversePayment({ id: second.installment!.id });

      const snapshot = await caller.getLoanEvaluationSnapshot({ loanId: loan.loanId });

      expect(snapshot.loanId).to.equal(loan.loanId);
      expect(snapshot.terms.cuota).to.equal(1000);
      expect(snapshot.terms.termLength).to.equal(4);

      // Raw ledger is unfiltered: the reversed row is present.
      const statuses = snapshot.ledger.map((p) => p.status);
      expect(statuses).to.include("REVERSED");

      // Derived excludes it: only the first payment counts toward cuotas.
      expect(snapshot.derived.totalInstallmentPaid).to.equal(1000);
      expect(snapshot.derived.cuotasCovered).to.equal(1);
      expect(snapshot.derived.pendingPayments).to.equal(3);
    });

    it("rejects unauthenticated callers", async () => {
      const anon = createUnauthenticatedCaller(db);
      try {
        await anon.getLoanEvaluationSnapshot({ loanId: 1 });
        expect.fail("Expected UNAUTHORIZED error");
      } catch (error) {
        expect(error).to.be.instanceOf(TRPCError);
        expect((error as TRPCError).code).to.equal("UNAUTHORIZED");
      }
    });
  });

  describe("getLoanHealth", () => {
    it("runs the full spec check registry and returns no narration when explain is false", async () => {
      const { loan, collector } = await createCustomerWithLoan(FRESH_START());
      await caller.createPayment({
        loanId: loan.loanId,
        amount: 1000,
        collectedById: collector.id
      });

      const health = await caller.getLoanHealth({ loanId: loan.loanId, explain: false });

      expect(health.report.results.length).to.be.greaterThan(0);
      expect(health.report.pass).to.equal(true);
      expect(health.narration).to.equal(null);
    });

    it("skips narration gracefully when explain is true but copilot deps aren't configured", async () => {
      const { loan, collector } = await createCustomerWithLoan(FRESH_START());
      await caller.createPayment({
        loanId: loan.loanId,
        amount: 1000,
        collectedById: collector.id
      });

      const health = await caller.getLoanHealth({ loanId: loan.loanId, explain: true });
      expect(health.narration).to.equal(null);
    });

    it("returns an LLM narration when explain is true and a model is wired", async () => {
      const { loan, collector } = await createCustomerWithLoan(FRESH_START());
      await caller.createPayment({
        loanId: loan.loanId,
        amount: 1000,
        collectedById: collector.id
      });

      const fakeModel = {
        invoke: async () => ({ content: "Explicación de prueba" })
      } as unknown as BaseChatModel;
      setCopilotDeps({
        toolExecutor: (async () => ({ success: true, message: "" })) as unknown as ToolExecutor,
        createModel: () => fakeModel
      });

      const health = await caller.getLoanHealth({ loanId: loan.loanId, explain: true });
      expect(health.narration).to.equal("Explicación de prueba");
    });

    it("rejects unauthenticated callers", async () => {
      const anon = createUnauthenticatedCaller(db);
      try {
        await anon.getLoanHealth({ loanId: 1, explain: false });
        expect.fail("Expected UNAUTHORIZED error");
      } catch (error) {
        expect(error).to.be.instanceOf(TRPCError);
        expect((error as TRPCError).code).to.equal("UNAUTHORIZED");
      }
    });
  });

  describe("runPortfolioHealthCheck", () => {
    it("scans ACTIVE loans by default and aggregates pass/fail", async () => {
      const { loan: loanA, collector } = await createCustomerWithLoan(FRESH_START());
      await caller.createPayment({
        loanId: loanA.loanId,
        amount: 1000,
        collectedById: collector.id
      });

      const { loan: loanB } = await createCustomerWithLoan(FRESH_START());
      await caller.updateLoanStatus({ loanId: loanB.loanId, status: "COMPLETED" });

      const report = await caller.runPortfolioHealthCheck({ includeAllStatuses: false });

      expect(report.loansChecked).to.equal(1); // loanB is COMPLETED, excluded by default
      expect(report.loansPassing).to.equal(1);
      expect(report.loansFailing).to.equal(0);
    });

    it("widens the scan to every status when includeAllStatuses is set", async () => {
      const { loan: loanA, collector } = await createCustomerWithLoan(FRESH_START());
      await caller.createPayment({
        loanId: loanA.loanId,
        amount: 1000,
        collectedById: collector.id
      });

      const { loan: loanB } = await createCustomerWithLoan(FRESH_START());
      await caller.updateLoanStatus({ loanId: loanB.loanId, status: "COMPLETED" });

      const report = await caller.runPortfolioHealthCheck({ includeAllStatuses: true });
      expect(report.loansChecked).to.equal(2);
    });

    it("rejects unauthenticated callers", async () => {
      const anon = createUnauthenticatedCaller(db);
      try {
        await anon.runPortfolioHealthCheck({ includeAllStatuses: false });
        expect.fail("Expected UNAUTHORIZED error");
      } catch (error) {
        expect(error).to.be.instanceOf(TRPCError);
        expect((error as TRPCError).code).to.equal("UNAUTHORIZED");
      }
    });
  });
});
