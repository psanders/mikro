/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createListPaymentsByMember } from "../../src/api/payments/createListPaymentsByMember.js";
import { ValidationError } from "@mikro/common";

describe("createListPaymentsByMember", () => {
  const validMemberId = "550e8400-e29b-41d4-a716-446655440000";
  const validInput = {
    memberId: validMemberId,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-01-31"),
  };

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should return payments for the specified member", async () => {
      // Arrange
      const expectedPayments = [
        {
          id: "payment-1",
          loanId: "loan-1",
          amount: 650,
          paidAt: new Date("2026-01-15"),
          method: "CASH",
          status: "COMPLETED",
          notes: null,
          collectedById: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];
      const mockClient = {
        payment: {
          findMany: sinon.stub().resolves(expectedPayments),
        },
      };
      const listPaymentsByMember = createListPaymentsByMember(mockClient as any);

      // Act
      const result = await listPaymentsByMember(validInput);

      // Assert
      expect(result).to.have.lengthOf(1);
      expect(mockClient.payment.findMany.calledOnce).to.be.true;
      expect(
        mockClient.payment.findMany.calledWith(
          sinon.match({
            where: sinon.match({
              loan: { memberId: validMemberId },
            }),
          })
        )
      ).to.be.true;
    });

    it("should return payments with pagination", async () => {
      // Arrange
      const inputWithPagination = { ...validInput, limit: 10, offset: 5 };
      const mockClient = {
        payment: {
          findMany: sinon.stub().resolves([]),
        },
      };
      const listPaymentsByMember = createListPaymentsByMember(mockClient as any);

      // Act
      await listPaymentsByMember(inputWithPagination);

      // Assert
      expect(
        mockClient.payment.findMany.calledWith(
          sinon.match({
            take: 10,
            skip: 5,
          })
        )
      ).to.be.true;
    });

    it("should return empty array when no payments found", async () => {
      // Arrange
      const mockClient = {
        payment: {
          findMany: sinon.stub().resolves([]),
        },
      };
      const listPaymentsByMember = createListPaymentsByMember(mockClient as any);

      // Act
      const result = await listPaymentsByMember(validInput);

      // Assert
      expect(result).to.be.an("array").that.is.empty;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for invalid member UUID", async () => {
      // Arrange
      const mockClient = {
        payment: { findMany: sinon.stub() },
      };
      const listPaymentsByMember = createListPaymentsByMember(mockClient as any);

      // Act & Assert
      try {
        await listPaymentsByMember({ ...validInput, memberId: "invalid-uuid" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.payment.findMany.called).to.be.false;
      }
    });

    it("should throw ValidationError for missing memberId", async () => {
      // Arrange
      const mockClient = {
        payment: { findMany: sinon.stub() },
      };
      const listPaymentsByMember = createListPaymentsByMember(mockClient as any);

      // Act & Assert
      try {
        await listPaymentsByMember({
          startDate: new Date(),
          endDate: new Date(),
        } as any);
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.payment.findMany.called).to.be.false;
      }
    });

    it("should throw ValidationError for missing date range", async () => {
      // Arrange
      const mockClient = {
        payment: { findMany: sinon.stub() },
      };
      const listPaymentsByMember = createListPaymentsByMember(mockClient as any);

      // Act & Assert
      try {
        await listPaymentsByMember({ memberId: validMemberId } as any);
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.payment.findMany.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        payment: {
          findMany: sinon.stub().rejects(new Error("Connection failed")),
        },
      };
      const listPaymentsByMember = createListPaymentsByMember(mockClient as any);

      // Act & Assert
      try {
        await listPaymentsByMember(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Connection failed");
      }
    });
  });
});
