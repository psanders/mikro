/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createCreatePayment } from "../../src/api/payments/createCreatePayment.js";
import { ValidationError } from "@mikro/common";

describe("createCreatePayment", () => {
  const validNumericLoanId = 10000;
  const validLoanUuid = "550e8400-e29b-41d4-a716-446655440000";
  const validCollectorId = "660e8400-e29b-41d4-a716-446655440001";
  const validInput = {
    loanId: validNumericLoanId,
    amount: 650,
    collectedById: validCollectorId
  };

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should create a payment with default method CASH", async () => {
      // Arrange
      const expectedPayment = {
        id: "payment-123",
        loanId: validLoanUuid,
        amount: 650,
        paidAt: new Date(),
        method: "CASH",
        status: "COMPLETED",
        notes: null,
        collectedById: validCollectorId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const mockClient = {
        loan: {
          findUnique: sinon.stub().resolves({ id: validLoanUuid })
        },
        payment: {
          findMany: sinon.stub().resolves([]), // No recent payments
          create: sinon.stub().resolves(expectedPayment)
        }
      };
      const createPayment = createCreatePayment(mockClient as any);

      // Act
      const result = await createPayment(validInput);

      // Assert
      expect(result.id).to.equal("payment-123");
      expect(result.method).to.equal("CASH");
      expect(mockClient.loan.findUnique.calledOnce).to.be.true;
      expect(
        mockClient.loan.findUnique.calledWith({
          where: { loanId: validNumericLoanId },
          select: { id: true }
        })
      ).to.be.true;
      expect(mockClient.payment.create.calledOnce).to.be.true;
      expect(mockClient.payment.create.calledOnce).to.be.true;
      const createCall = mockClient.payment.create.getCall(0);
      expect(createCall.args[0].data.loanId).to.equal(validLoanUuid);
      expect(createCall.args[0].data.amount).to.equal(650);
      expect(createCall.args[0].data.method).to.equal("CASH");
      expect(createCall.args[0].data.collectedById).to.equal(validCollectorId);
      // paidAt and notes should be undefined (not included in data)
      expect(createCall.args[0].data.paidAt).to.be.undefined;
      expect(createCall.args[0].data.notes).to.be.undefined;
    });

    it("should create a payment with explicit method TRANSFER", async () => {
      // Arrange
      const inputWithMethod = { ...validInput, method: "TRANSFER" as const };
      const expectedPayment = {
        id: "payment-456",
        loanId: validLoanUuid,
        amount: 650,
        method: "TRANSFER",
        paidAt: new Date(),
        status: "COMPLETED",
        notes: null,
        collectedById: validCollectorId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const mockClient = {
        loan: {
          findUnique: sinon.stub().resolves({ id: validLoanUuid })
        },
        payment: {
          findMany: sinon.stub().resolves([]), // No recent payments
          create: sinon.stub().resolves(expectedPayment)
        }
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
        notes: "Weekly payment"
      };
      const expectedPayment = {
        id: "payment-789",
        loanId: validLoanUuid,
        amount: 650,
        paidAt,
        method: "CASH",
        status: "COMPLETED",
        notes: "Weekly payment",
        collectedById: validCollectorId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const mockClient = {
        loan: {
          findUnique: sinon.stub().resolves({ id: validLoanUuid })
        },
        payment: {
          findMany: sinon.stub().resolves([]), // No recent payments
          create: sinon.stub().resolves(expectedPayment)
        }
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
    it("should throw ValidationError for invalid loanId (not a positive integer)", async () => {
      // Arrange
      const mockClient = {
        loan: { findUnique: sinon.stub() },
        payment: { create: sinon.stub() }
      };
      const createPayment = createCreatePayment(mockClient as any);

      // Act & Assert
      try {
        await createPayment({ ...validInput, loanId: -1 });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.loan.findUnique.called).to.be.false;
        expect(mockClient.payment.create.called).to.be.false;
      }
    });

    it("should throw error when loan not found", async () => {
      // Arrange
      const mockClient = {
        loan: {
          findUnique: sinon.stub().resolves(null)
        },
        payment: {
          findMany: sinon.stub(),
          create: sinon.stub()
        }
      };
      const createPayment = createCreatePayment(mockClient as any);

      // Act & Assert
      try {
        await createPayment(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.include("Loan not found");
        expect(mockClient.payment.findMany.called).to.be.false;
        expect(mockClient.payment.create.called).to.be.false;
      }
    });

    it("should throw error when duplicate payment detected within 10 minutes", async () => {
      // Arrange
      const recentPayment = {
        id: "recent-payment-123",
        amount: 650,
        paidAt: new Date(),
        createdAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
        method: "CASH",
        status: "COMPLETED",
        notes: null,
        loanId: validLoanUuid,
        collectedById: validCollectorId,
        updatedAt: new Date()
      };
      const mockClient = {
        loan: {
          findUnique: sinon.stub().resolves({ id: validLoanUuid })
        },
        payment: {
          findMany: sinon.stub().resolves([recentPayment]),
          create: sinon.stub()
        }
      };
      const createPayment = createCreatePayment(mockClient as any);

      // Act & Assert
      try {
        await createPayment(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.include("Duplicate payment blocked");
        expect((error as Error).message).to.include(`loan ${validNumericLoanId}`);
        expect((error as Error).message).to.include("Wait at least 10 minutes");
        expect(mockClient.payment.findMany.calledOnce).to.be.true;
        expect(mockClient.payment.create.called).to.be.false;
        const findManyCall = mockClient.payment.findMany.getCall(0);
        expect(findManyCall.args[0].where.loanId).to.equal(validLoanUuid);
        expect(findManyCall.args[0].where.status).to.equal("COMPLETED");
        expect(findManyCall.args[0].where.paidAt.gte).to.be.instanceOf(Date);
        expect(findManyCall.args[0].orderBy.paidAt).to.equal("desc");
        expect(findManyCall.args[0].take).to.equal(5);
      }
    });

    it("should allow payment when no recent payment exists", async () => {
      // Arrange
      const expectedPayment = {
        id: "payment-123",
        loanId: validLoanUuid,
        amount: 650,
        paidAt: new Date(),
        method: "CASH",
        status: "COMPLETED",
        notes: null,
        collectedById: validCollectorId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const mockClient = {
        loan: {
          findUnique: sinon.stub().resolves({ id: validLoanUuid })
        },
        payment: {
          findMany: sinon.stub().resolves([]), // No recent payment
          create: sinon.stub().resolves(expectedPayment)
        }
      };
      const createPayment = createCreatePayment(mockClient as any);

      // Act
      const result = await createPayment(validInput);

      // Assert
      expect(result.id).to.equal("payment-123");
      expect(mockClient.payment.findMany.calledOnce).to.be.true;
      expect(mockClient.payment.create.calledOnce).to.be.true;
    });

    it("should allow payment when existing payment is older than 10 minutes", async () => {
      // Arrange
      const oldPayment = {
        id: "old-payment-123",
        amount: 650,
        paidAt: new Date(),
        createdAt: new Date(Date.now() - 15 * 60 * 1000), // 15 minutes ago
        method: "CASH",
        status: "COMPLETED",
        notes: null,
        loanId: validLoanUuid,
        collectedById: validCollectorId,
        updatedAt: new Date()
      };
      const expectedPayment = {
        id: "payment-123",
        loanId: validLoanUuid,
        amount: 650,
        paidAt: new Date(),
        method: "CASH",
        status: "COMPLETED",
        notes: null,
        collectedById: validCollectorId,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const mockClient = {
        loan: {
          findUnique: sinon.stub().resolves({ id: validLoanUuid })
        },
        payment: {
          findMany: sinon.stub().resolves([oldPayment]), // Old payment exists but > 10 min ago
          create: sinon.stub().resolves(expectedPayment)
        }
      };
      const createPayment = createCreatePayment(mockClient as any);

      // Act
      const result = await createPayment(validInput);

      // Assert
      expect(result.id).to.equal("payment-123");
      expect(mockClient.payment.findMany.calledOnce).to.be.true;
      expect(mockClient.payment.create.calledOnce).to.be.true;
    });

    it("should throw ValidationError for negative amount", async () => {
      // Arrange
      const mockClient = {
        payment: { create: sinon.stub() }
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
        payment: { create: sinon.stub() }
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
    it("should propagate the error from loan lookup", async () => {
      // Arrange
      const mockClient = {
        loan: {
          findUnique: sinon.stub().rejects(new Error("Connection failed"))
        },
        payment: {
          create: sinon.stub()
        }
      };
      const createPayment = createCreatePayment(mockClient as any);

      // Act & Assert
      try {
        await createPayment(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Connection failed");
        expect(mockClient.payment.create.called).to.be.false;
      }
    });

    it("should propagate the error from payment creation", async () => {
      // Arrange
      const mockClient = {
        loan: {
          findUnique: sinon.stub().resolves({ id: validLoanUuid })
        },
        payment: {
          findMany: sinon.stub().resolves([]), // No recent payments
          create: sinon.stub().rejects(new Error("Payment creation failed"))
        }
      };
      const createPayment = createCreatePayment(mockClient as any);

      // Act & Assert
      try {
        await createPayment(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Payment creation failed");
      }
    });
  });
});
