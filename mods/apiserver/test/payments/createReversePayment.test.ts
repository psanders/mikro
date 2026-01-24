/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createReversePayment } from "../../src/api/payments/createReversePayment.js";
import { ValidationError } from "@mikro/common";

describe("createReversePayment", () => {
  const validPaymentId = "550e8400-e29b-41d4-a716-446655440000";
  const validInput = {
    id: validPaymentId,
  };

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should reverse a payment without notes", async () => {
      // Arrange
      const expectedPayment = {
        id: validPaymentId,
        loanId: "loan-123",
        amount: 650,
        paidAt: new Date(),
        method: "CASH",
        status: "REVERSED",
        notes: null,
        collectedById: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockClient = {
        payment: {
          update: sinon.stub().resolves(expectedPayment),
        },
      };
      const reversePayment = createReversePayment(mockClient as any);

      // Act
      const result = await reversePayment(validInput);

      // Assert
      expect(result.status).to.equal("REVERSED");
      expect(mockClient.payment.update.calledOnce).to.be.true;
      expect(
        mockClient.payment.update.calledWith(
          sinon.match({
            where: { id: validPaymentId },
            data: { status: "REVERSED" },
          })
        )
      ).to.be.true;
    });

    it("should reverse a payment with notes", async () => {
      // Arrange
      const inputWithNotes = { ...validInput, notes: "Customer requested refund" };
      const expectedPayment = {
        id: validPaymentId,
        loanId: "loan-123",
        amount: 650,
        paidAt: new Date(),
        method: "CASH",
        status: "REVERSED",
        notes: "Customer requested refund",
        collectedById: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockClient = {
        payment: {
          update: sinon.stub().resolves(expectedPayment),
        },
      };
      const reversePayment = createReversePayment(mockClient as any);

      // Act
      const result = await reversePayment(inputWithNotes);

      // Assert
      expect(result.notes).to.equal("Customer requested refund");
      expect(
        mockClient.payment.update.calledWith(
          sinon.match({
            data: { status: "REVERSED", notes: "Customer requested refund" },
          })
        )
      ).to.be.true;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for invalid payment ID UUID", async () => {
      // Arrange
      const mockClient = {
        payment: { update: sinon.stub() },
      };
      const reversePayment = createReversePayment(mockClient as any);

      // Act & Assert
      try {
        await reversePayment({ id: "invalid-uuid" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.payment.update.called).to.be.false;
      }
    });

    it("should throw ValidationError for missing id", async () => {
      // Arrange
      const mockClient = {
        payment: { update: sinon.stub() },
      };
      const reversePayment = createReversePayment(mockClient as any);

      // Act & Assert
      try {
        await reversePayment({} as any);
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.payment.update.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        payment: {
          update: sinon.stub().rejects(new Error("Payment not found")),
        },
      };
      const reversePayment = createReversePayment(mockClient as any);

      // Act & Assert
      try {
        await reversePayment(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Payment not found");
      }
    });
  });
});
