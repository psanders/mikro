/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createListPayments } from "../../src/api/payments/createListPayments.js";
import { ValidationError } from "@mikro/common";

describe("createListPayments", () => {
  const validInput = {
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-01-31")
  };

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should return payments within date range", async () => {
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
          updatedAt: new Date()
        },
        {
          id: "payment-2",
          loanId: "loan-2",
          amount: 1300,
          paidAt: new Date("2026-01-20"),
          method: "TRANSFER",
          status: "COMPLETED",
          notes: null,
          collectedById: null,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      const mockClient = {
        payment: {
          findMany: sinon.stub().resolves(expectedPayments)
        }
      };
      const listPayments = createListPayments(mockClient as any);

      // Act
      const result = await listPayments(validInput);

      // Assert
      expect(result).to.have.lengthOf(2);
      expect(result[0].id).to.equal("payment-1");
      expect(mockClient.payment.findMany.calledOnce).to.be.true;
    });

    it("should return payments with pagination", async () => {
      // Arrange
      const inputWithPagination = { ...validInput, limit: 10, offset: 5 };
      const mockClient = {
        payment: {
          findMany: sinon.stub().resolves([])
        }
      };
      const listPayments = createListPayments(mockClient as any);

      // Act
      await listPayments(inputWithPagination);

      // Assert
      expect(
        mockClient.payment.findMany.calledWith(
          sinon.match({
            take: 10,
            skip: 5
          })
        )
      ).to.be.true;
    });

    it("should return empty array when no payments exist", async () => {
      // Arrange
      const mockClient = {
        payment: {
          findMany: sinon.stub().resolves([])
        }
      };
      const listPayments = createListPayments(mockClient as any);

      // Act
      const result = await listPayments(validInput);

      // Assert
      expect(result).to.be.an("array").that.is.empty;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for missing startDate", async () => {
      // Arrange
      const mockClient = {
        payment: { findMany: sinon.stub() }
      };
      const listPayments = createListPayments(mockClient as any);

      // Act & Assert
      try {
        await listPayments({ endDate: new Date() } as any);
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.payment.findMany.called).to.be.false;
      }
    });

    it("should throw ValidationError for negative offset", async () => {
      // Arrange
      const mockClient = {
        payment: { findMany: sinon.stub() }
      };
      const listPayments = createListPayments(mockClient as any);

      // Act & Assert
      try {
        await listPayments({ ...validInput, offset: -1 });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.payment.findMany.called).to.be.false;
      }
    });

    it("should throw ValidationError for limit exceeding max", async () => {
      // Arrange
      const mockClient = {
        payment: { findMany: sinon.stub() }
      };
      const listPayments = createListPayments(mockClient as any);

      // Act & Assert
      try {
        await listPayments({ ...validInput, limit: 101 });
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
          findMany: sinon.stub().rejects(new Error("Connection failed"))
        }
      };
      const listPayments = createListPayments(mockClient as any);

      // Act & Assert
      try {
        await listPayments(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Connection failed");
      }
    });
  });
});
