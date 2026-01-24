/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createCreatePayment } from "../../src/api/payments/createCreatePayment.js";
import { ValidationError } from "@mikro/common";

describe("createCreatePayment", () => {
  const validLoanId = "550e8400-e29b-41d4-a716-446655440000";
  const validCollectorId = "660e8400-e29b-41d4-a716-446655440001";
  const validInput = {
    loanId: validLoanId,
    amount: 650,
  };

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should create a payment with default method CASH", async () => {
      // Arrange
      const expectedPayment = {
        id: "payment-123",
        loanId: validLoanId,
        amount: 650,
        paidAt: new Date(),
        method: "CASH",
        status: "COMPLETED",
        notes: null,
        collectedById: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockClient = {
        payment: {
          create: sinon.stub().resolves(expectedPayment),
        },
      };
      const createPayment = createCreatePayment(mockClient as any);

      // Act
      const result = await createPayment(validInput);

      // Assert
      expect(result.id).to.equal("payment-123");
      expect(result.method).to.equal("CASH");
      expect(mockClient.payment.create.calledOnce).to.be.true;
    });

    it("should create a payment with explicit method TRANSFER", async () => {
      // Arrange
      const inputWithMethod = { ...validInput, method: "TRANSFER" as const };
      const expectedPayment = {
        id: "payment-456",
        ...inputWithMethod,
        paidAt: new Date(),
        status: "COMPLETED",
        notes: null,
        collectedById: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockClient = {
        payment: {
          create: sinon.stub().resolves(expectedPayment),
        },
      };
      const createPayment = createCreatePayment(mockClient as any);

      // Act
      const result = await createPayment(inputWithMethod);

      // Assert
      expect(result.method).to.equal("TRANSFER");
    });

    it("should create a payment with all optional fields", async () => {
      // Arrange
      const paidAt = new Date("2026-01-15");
      const fullInput = {
        ...validInput,
        paidAt,
        method: "CASH" as const,
        collectedById: validCollectorId,
        notes: "Weekly payment",
      };
      const expectedPayment = {
        id: "payment-789",
        ...fullInput,
        status: "COMPLETED",
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockClient = {
        payment: {
          create: sinon.stub().resolves(expectedPayment),
        },
      };
      const createPayment = createCreatePayment(mockClient as any);

      // Act
      const result = await createPayment(fullInput);

      // Assert
      expect(result.notes).to.equal("Weekly payment");
      expect(result.collectedById).to.equal(validCollectorId);
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for invalid loanId UUID", async () => {
      // Arrange
      const mockClient = {
        payment: { create: sinon.stub() },
      };
      const createPayment = createCreatePayment(mockClient as any);

      // Act & Assert
      try {
        await createPayment({ ...validInput, loanId: "invalid-uuid" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.payment.create.called).to.be.false;
      }
    });

    it("should throw ValidationError for negative amount", async () => {
      // Arrange
      const mockClient = {
        payment: { create: sinon.stub() },
      };
      const createPayment = createCreatePayment(mockClient as any);

      // Act & Assert
      try {
        await createPayment({ ...validInput, amount: -100 });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.payment.create.called).to.be.false;
      }
    });

    it("should throw ValidationError for invalid collectedById UUID", async () => {
      // Arrange
      const mockClient = {
        payment: { create: sinon.stub() },
      };
      const createPayment = createCreatePayment(mockClient as any);

      // Act & Assert
      try {
        await createPayment({ ...validInput, collectedById: "invalid" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.payment.create.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        payment: {
          create: sinon.stub().rejects(new Error("Connection failed")),
        },
      };
      const createPayment = createCreatePayment(mockClient as any);

      // Act & Assert
      try {
        await createPayment(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Connection failed");
      }
    });
  });
});
