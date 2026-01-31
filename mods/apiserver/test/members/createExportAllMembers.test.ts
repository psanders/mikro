/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createExportAllMembers } from "../../src/api/members/createExportAllMembers.js";

describe("createExportAllMembers", () => {
  const validReferrerId = "550e8400-e29b-41d4-a716-446655440000";

  const createMockMemberWithLoans = (id: string, name: string) => ({
    id,
    name,
    phone: "+1234567890",
    idNumber: "ABC123",
    collectionPoint: "https://maps.google.com/place",
    homeAddress: "123 Main St",
    jobPosition: null,
    income: null,
    isBusinessOwner: false,
    isActive: true,
    idCardOnRecord: false,
    notes: "Test notes",
    createdById: null,
    referredById: validReferrerId,
    assignedCollectorId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    loans: [
      {
        id: "loan-1",
        loanId: 10001,
        type: "SAN",
        status: "ACTIVE",
        principal: 5000,
        termLength: 10,
        paymentAmount: 550,
        paymentFrequency: "WEEKLY",
        notes: null,
        memberId: id,
        createdAt: new Date(),
        updatedAt: new Date(),
        payments: [
          {
            id: "payment-1",
            amount: 550,
            paidAt: new Date(),
            method: "CASH",
            status: "COMPLETED",
            notes: null,
            loanId: "loan-1",
            collectedById: null,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      }
    ],
    referredBy: { name: "John Referrer" }
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should return all active members with loans", async () => {
      // Arrange
      const expectedMembers = [
        createMockMemberWithLoans("member-1", "John Doe"),
        createMockMemberWithLoans("member-2", "Jane Smith"),
        createMockMemberWithLoans("member-3", "Bob Wilson")
      ];
      const mockClient = {
        member: {
          findMany: sinon.stub().resolves(expectedMembers)
        }
      };
      const exportAllMembers = createExportAllMembers(mockClient as any);

      // Act
      const result = await exportAllMembers({});

      // Assert
      expect(result).to.have.length(3);
      expect(result[0].loans).to.have.length(1);
      expect(result[0].referredBy.name).to.equal("John Referrer");
      expect(mockClient.member.findMany.calledOnce).to.be.true;

      const callArgs = mockClient.member.findMany.firstCall.args[0];
      expect(callArgs.where.isActive).to.equal(true);
      expect(callArgs.include.loans).to.exist;
      expect(callArgs.include.referredBy).to.exist;
    });

    it("should return empty array when no members found", async () => {
      // Arrange
      const mockClient = {
        member: {
          findMany: sinon.stub().resolves([])
        }
      };
      const exportAllMembers = createExportAllMembers(mockClient as any);

      // Act
      const result = await exportAllMembers({});

      // Assert
      expect(result).to.be.an("array").that.is.empty;
    });

    it("should only query for active members", async () => {
      // Arrange
      const mockClient = {
        member: {
          findMany: sinon.stub().resolves([])
        }
      };
      const exportAllMembers = createExportAllMembers(mockClient as any);

      // Act
      await exportAllMembers({});

      // Assert
      const callArgs = mockClient.member.findMany.firstCall.args[0];
      expect(callArgs.where.isActive).to.equal(true);
    });

    it("should only include active loans", async () => {
      // Arrange
      const mockClient = {
        member: {
          findMany: sinon.stub().resolves([])
        }
      };
      const exportAllMembers = createExportAllMembers(mockClient as any);

      // Act
      await exportAllMembers({});

      // Assert
      const callArgs = mockClient.member.findMany.firstCall.args[0];
      expect(callArgs.include.loans.where.status).to.equal("ACTIVE");
    });

    it("should only include completed payments", async () => {
      // Arrange
      const mockClient = {
        member: {
          findMany: sinon.stub().resolves([])
        }
      };
      const exportAllMembers = createExportAllMembers(mockClient as any);

      // Act
      await exportAllMembers({});

      // Assert
      const callArgs = mockClient.member.findMany.firstCall.args[0];
      expect(callArgs.include.loans.include.payments.where.status).to.equal("COMPLETED");
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        member: {
          findMany: sinon.stub().rejects(new Error("Database error"))
        }
      };
      const exportAllMembers = createExportAllMembers(mockClient as any);

      // Act & Assert
      try {
        await exportAllMembers({});
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Database error");
      }
    });
  });
});
