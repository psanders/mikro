/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createListPaymentsByCustomer } from "../../src/api/payments/createListPaymentsByCustomer.js";
import { ValidationError } from "@mikro/common";

describe("createListPaymentsByCustomer", () => {
  const validCustomerId = "550e8400-e29b-41d4-a716-446655440000";
  const validInput = {
    customerId: validCustomerId,
    startDate: new Date("2026-01-01"),
    endDate: new Date("2026-01-31")
  };

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should return payments for the specified customer", async () => {
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
        }
      ];
      const mockClient = {
        payment: {
          findMany: sinon.stub().resolves(expectedPayments)
        }
      };
      const listPaymentsByCustomer = createListPaymentsByCustomer(mockClient as any);

      // Act
      const result = await listPaymentsByCustomer(validInput);

      // Assert
      expect(result).to.have.lengthOf(1);
      expect(mockClient.payment.findMany.calledOnce).to.be.true;
      expect(
        mockClient.payment.findMany.calledWith(
          sinon.match({
            where: sinon.match({
              loan: { customerId: validCustomerId }
            })
          })
        )
      ).to.be.true;
    });

    it("should return payments with pagination", async () => {
      // Arrange
      const inputWithPagination = { ...validInput, limit: 10, offset: 5 };
      const mockClient = {
        payment: {
          findMany: sinon.stub().resolves([])
        }
      };
      const listPaymentsByCustomer = createListPaymentsByCustomer(mockClient as any);

      // Act
      await listPaymentsByCustomer(inputWithPagination);

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

    it("should return empty array when no payments found", async () => {
      // Arrange
      const mockClient = {
        payment: {
          findMany: sinon.stub().resolves([])
        }
      };
      const listPaymentsByCustomer = createListPaymentsByCustomer(mockClient as any);

      // Act
      const result = await listPaymentsByCustomer(validInput);

      // Assert
      expect(result).to.be.an("array").that.is.empty;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for invalid customer UUID", async () => {
      // Arrange
      const mockClient = {
        payment: { findMany: sinon.stub() }
      };
      const listPaymentsByCustomer = createListPaymentsByCustomer(mockClient as any);

      // Act & Assert
      try {
        await listPaymentsByCustomer({ ...validInput, customerId: "invalid-uuid" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.payment.findMany.called).to.be.false;
      }
    });

    it("should throw ValidationError for missing customerId", async () => {
      // Arrange
      const mockClient = {
        payment: { findMany: sinon.stub() }
      };
      const listPaymentsByCustomer = createListPaymentsByCustomer(mockClient as any);

      // Act & Assert
      try {
        await listPaymentsByCustomer({
          startDate: new Date(),
          endDate: new Date()
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
        payment: { findMany: sinon.stub() }
      };
      const listPaymentsByCustomer = createListPaymentsByCustomer(mockClient as any);

      // Act & Assert
      try {
        await listPaymentsByCustomer({ customerId: validCustomerId } as any);
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
      const listPaymentsByCustomer = createListPaymentsByCustomer(mockClient as any);

      // Act & Assert
      try {
        await listPaymentsByCustomer(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Connection failed");
      }
    });
  });
});
