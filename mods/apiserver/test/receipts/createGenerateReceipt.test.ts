/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createGenerateReceipt } from "../../src/api/receipts/createGenerateReceipt.js";
import { ValidationError } from "@mikro/common";

// Note: Full receipt generation requires file system setup (keys, fonts, assets)
// and image generation libraries that can't be easily mocked in unit tests.
// This test focuses on validation and error cases.
// Full functionality should be tested in integration tests.

describe("createGenerateReceipt", () => {
  const validPaymentId = "550e8400-e29b-41d4-a716-446655440000";
  const validInput = {
    paymentId: validPaymentId
  };

  afterEach(() => {
    sinon.restore();
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for invalid UUID", async () => {
      // Arrange
      const mockClient = {
        payment: { findUnique: sinon.stub() }
      };
      const generateReceipt = createGenerateReceipt({
        db: mockClient as any
      });

      // Act & Assert
      try {
        await generateReceipt({ paymentId: "not-a-valid-uuid" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.payment.findUnique.called).to.be.false;
      }
    });

    it("should throw ValidationError for missing paymentId", async () => {
      // Arrange
      const mockClient = {
        payment: { findUnique: sinon.stub() }
      };
      const generateReceipt = createGenerateReceipt({
        db: mockClient as any
      });

      // Act & Assert
      try {
        await generateReceipt({} as any);
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.payment.findUnique.called).to.be.false;
      }
    });
  });

  describe("when payment not found", () => {
    it("should throw error when payment does not exist", async () => {
      // Arrange
      const mockClient = {
        payment: {
          findUnique: sinon.stub().resolves(null)
        }
      };
      const generateReceipt = createGenerateReceipt({
        db: mockClient as any
      });

      // Act & Assert
      try {
        await generateReceipt(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.include("Payment not found");
        expect(mockClient.payment.findUnique.calledOnce).to.be.true;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        payment: {
          findUnique: sinon.stub().rejects(new Error("Database error"))
        }
      };
      const generateReceipt = createGenerateReceipt({
        db: mockClient as any
      });

      // Act & Assert
      try {
        await generateReceipt(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Database error");
      }
    });
  });
});
