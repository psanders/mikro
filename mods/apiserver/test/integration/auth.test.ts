/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Integration tests for authentication.
 * Verifies that protected procedures reject unauthenticated calls.
 */
import { expect } from "chai";
import { TRPCError } from "@trpc/server";
import {
  createTestDb,
  createUnauthenticatedCaller,
  applySchema,
  type TestDb,
  type UnauthenticatedCaller
} from "./setup.js";

describe("Authentication Integration", () => {
  let db: TestDb;
  let unauthenticatedCaller: UnauthenticatedCaller;

  before(async () => {
    db = createTestDb();
    await applySchema(db);
    unauthenticatedCaller = createUnauthenticatedCaller(db);
  });

  after(async () => {
    await db.$disconnect();
  });

  describe("public procedures", () => {
    it("should allow unauthenticated ping", async () => {
      const result = await unauthenticatedCaller.ping();

      expect(result.message).to.equal("pong");
      expect(result.timestamp).to.be.a("number");
    });
  });

  describe("protected procedures - Members", () => {
    it("should reject unauthenticated createMember", async () => {
      try {
        await unauthenticatedCaller.createMember({
          name: "Test User",
          phone: "+18091234590",
          idNumber: "001-1234567-8",
          collectionPoint: "Market Square",
          homeAddress: "123 Main St"
        });
        expect.fail("Expected UNAUTHORIZED error");
      } catch (error) {
        expect(error).to.be.instanceOf(TRPCError);
        expect((error as TRPCError).code).to.equal("UNAUTHORIZED");
      }
    });

    it("should reject unauthenticated getMember", async () => {
      try {
        await unauthenticatedCaller.getMember({
          id: "550e8400-e29b-41d4-a716-446655440000"
        });
        expect.fail("Expected UNAUTHORIZED error");
      } catch (error) {
        expect(error).to.be.instanceOf(TRPCError);
        expect((error as TRPCError).code).to.equal("UNAUTHORIZED");
      }
    });

    it("should reject unauthenticated updateMember", async () => {
      try {
        await unauthenticatedCaller.updateMember({
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "Updated Name"
        });
        expect.fail("Expected UNAUTHORIZED error");
      } catch (error) {
        expect(error).to.be.instanceOf(TRPCError);
        expect((error as TRPCError).code).to.equal("UNAUTHORIZED");
      }
    });

    it("should reject unauthenticated listMembers", async () => {
      try {
        await unauthenticatedCaller.listMembers({});
        expect.fail("Expected UNAUTHORIZED error");
      } catch (error) {
        expect(error).to.be.instanceOf(TRPCError);
        expect((error as TRPCError).code).to.equal("UNAUTHORIZED");
      }
    });

    it("should reject unauthenticated listMembersByReferrer", async () => {
      try {
        await unauthenticatedCaller.listMembersByReferrer({
          referredById: "550e8400-e29b-41d4-a716-446655440000"
        });
        expect.fail("Expected UNAUTHORIZED error");
      } catch (error) {
        expect(error).to.be.instanceOf(TRPCError);
        expect((error as TRPCError).code).to.equal("UNAUTHORIZED");
      }
    });

    it("should reject unauthenticated listMembersByCollector", async () => {
      try {
        await unauthenticatedCaller.listMembersByCollector({
          assignedCollectorId: "550e8400-e29b-41d4-a716-446655440000"
        });
        expect.fail("Expected UNAUTHORIZED error");
      } catch (error) {
        expect(error).to.be.instanceOf(TRPCError);
        expect((error as TRPCError).code).to.equal("UNAUTHORIZED");
      }
    });
  });

  describe("protected procedures - Users", () => {
    it("should reject unauthenticated createUser", async () => {
      try {
        await unauthenticatedCaller.createUser({
          name: "Test User"
        });
        expect.fail("Expected UNAUTHORIZED error");
      } catch (error) {
        expect(error).to.be.instanceOf(TRPCError);
        expect((error as TRPCError).code).to.equal("UNAUTHORIZED");
      }
    });

    it("should reject unauthenticated getUser", async () => {
      try {
        await unauthenticatedCaller.getUser({
          id: "550e8400-e29b-41d4-a716-446655440000"
        });
        expect.fail("Expected UNAUTHORIZED error");
      } catch (error) {
        expect(error).to.be.instanceOf(TRPCError);
        expect((error as TRPCError).code).to.equal("UNAUTHORIZED");
      }
    });

    it("should reject unauthenticated updateUser", async () => {
      try {
        await unauthenticatedCaller.updateUser({
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "Updated Name"
        });
        expect.fail("Expected UNAUTHORIZED error");
      } catch (error) {
        expect(error).to.be.instanceOf(TRPCError);
        expect((error as TRPCError).code).to.equal("UNAUTHORIZED");
      }
    });
  });

  describe("protected procedures - Loans", () => {
    it("should reject unauthenticated createLoan", async () => {
      try {
        await unauthenticatedCaller.createLoan({
          memberId: "550e8400-e29b-41d4-a716-446655440000",
          principal: 5000,
          termLength: 10,
          paymentAmount: 650,
          paymentFrequency: "WEEKLY"
        });
        expect.fail("Expected UNAUTHORIZED error");
      } catch (error) {
        expect(error).to.be.instanceOf(TRPCError);
        expect((error as TRPCError).code).to.equal("UNAUTHORIZED");
      }
    });
  });

  describe("protected procedures - Payments", () => {
    it("should reject unauthenticated createPayment", async () => {
      try {
        await unauthenticatedCaller.createPayment({
          loanId: "550e8400-e29b-41d4-a716-446655440000",
          amount: 650
        });
        expect.fail("Expected UNAUTHORIZED error");
      } catch (error) {
        expect(error).to.be.instanceOf(TRPCError);
        expect((error as TRPCError).code).to.equal("UNAUTHORIZED");
      }
    });

    it("should reject unauthenticated listPayments", async () => {
      try {
        await unauthenticatedCaller.listPayments({
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31")
        });
        expect.fail("Expected UNAUTHORIZED error");
      } catch (error) {
        expect(error).to.be.instanceOf(TRPCError);
        expect((error as TRPCError).code).to.equal("UNAUTHORIZED");
      }
    });

    it("should reject unauthenticated listPaymentsByMember", async () => {
      try {
        await unauthenticatedCaller.listPaymentsByMember({
          memberId: "550e8400-e29b-41d4-a716-446655440000",
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31")
        });
        expect.fail("Expected UNAUTHORIZED error");
      } catch (error) {
        expect(error).to.be.instanceOf(TRPCError);
        expect((error as TRPCError).code).to.equal("UNAUTHORIZED");
      }
    });

    it("should reject unauthenticated listPaymentsByReferrer", async () => {
      try {
        await unauthenticatedCaller.listPaymentsByReferrer({
          referredById: "550e8400-e29b-41d4-a716-446655440000",
          startDate: new Date("2026-01-01"),
          endDate: new Date("2026-12-31")
        });
        expect.fail("Expected UNAUTHORIZED error");
      } catch (error) {
        expect(error).to.be.instanceOf(TRPCError);
        expect((error as TRPCError).code).to.equal("UNAUTHORIZED");
      }
    });
  });

  describe("protected procedures - Chat", () => {
    it("should reject unauthenticated getChatHistory", async () => {
      try {
        await unauthenticatedCaller.getChatHistory({
          memberId: "550e8400-e29b-41d4-a716-446655440000"
        });
        expect.fail("Expected UNAUTHORIZED error");
      } catch (error) {
        expect(error).to.be.instanceOf(TRPCError);
        expect((error as TRPCError).code).to.equal("UNAUTHORIZED");
      }
    });
  });
});
