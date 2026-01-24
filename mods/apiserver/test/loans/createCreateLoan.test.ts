/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createCreateLoan } from "../../src/api/loans/createCreateLoan.js";
import { ValidationError } from "@mikro/common";

describe("createCreateLoan", () => {
  const validMemberId = "550e8400-e29b-41d4-a716-446655440000";
  const validInput = {
    memberId: validMemberId,
    principal: 5000,
    termLength: 10,
    paymentAmount: 650,
    paymentFrequency: "WEEKLY" as const
  };

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should create a loan with default type SAN", async () => {
      // Arrange
      const expectedLoan = {
        id: "loan-123",
        loanId: 10000,
        type: "SAN",
        status: "ACTIVE",
        ...validInput,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const mockClient = {
        loan: {
          findFirst: sinon.stub().resolves(null),
          create: sinon.stub().resolves(expectedLoan)
        }
      };
      const createLoan = createCreateLoan(mockClient as any);

      // Act
      const result = await createLoan(validInput);

      // Assert
      expect(result.id).to.equal("loan-123");
      expect(result.loanId).to.equal(10000);
      expect(result.type).to.equal("SAN");
      expect(mockClient.loan.findFirst.calledOnce).to.be.true;
      expect(mockClient.loan.create.calledOnce).to.be.true;
    });

    it("should increment loanId when loans exist", async () => {
      // Arrange
      const expectedLoan = {
        id: "loan-456",
        loanId: 10005,
        type: "SAN",
        status: "ACTIVE",
        ...validInput,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const mockClient = {
        loan: {
          findFirst: sinon.stub().resolves({ loanId: 10004 }),
          create: sinon.stub().resolves(expectedLoan)
        }
      };
      const createLoan = createCreateLoan(mockClient as any);

      // Act
      const result = await createLoan(validInput);

      // Assert
      expect(result.loanId).to.equal(10005);
      expect(
        mockClient.loan.create.calledWith(
          sinon.match({
            data: sinon.match({ loanId: 10005 })
          })
        )
      ).to.be.true;
    });

    it("should create a loan with explicit type", async () => {
      // Arrange
      const inputWithType = { ...validInput, type: "SAN" as const };
      const expectedLoan = {
        id: "loan-789",
        loanId: 10000,
        ...inputWithType,
        status: "ACTIVE",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const mockClient = {
        loan: {
          findFirst: sinon.stub().resolves(null),
          create: sinon.stub().resolves(expectedLoan)
        }
      };
      const createLoan = createCreateLoan(mockClient as any);

      // Act
      const result = await createLoan(inputWithType);

      // Assert
      expect(result.type).to.equal("SAN");
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for invalid memberId UUID", async () => {
      // Arrange
      const mockClient = {
        loan: {
          findFirst: sinon.stub(),
          create: sinon.stub()
        }
      };
      const createLoan = createCreateLoan(mockClient as any);

      // Act & Assert
      try {
        await createLoan({ ...validInput, memberId: "invalid-uuid" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.loan.create.called).to.be.false;
      }
    });

    it("should throw ValidationError for negative principal", async () => {
      // Arrange
      const mockClient = {
        loan: {
          findFirst: sinon.stub(),
          create: sinon.stub()
        }
      };
      const createLoan = createCreateLoan(mockClient as any);

      // Act & Assert
      try {
        await createLoan({ ...validInput, principal: -1000 });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.loan.create.called).to.be.false;
      }
    });

    it("should throw ValidationError for invalid paymentFrequency", async () => {
      // Arrange
      const mockClient = {
        loan: {
          findFirst: sinon.stub(),
          create: sinon.stub()
        }
      };
      const createLoan = createCreateLoan(mockClient as any);

      // Act & Assert
      try {
        await createLoan({ ...validInput, paymentFrequency: "MONTHLY" as any });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.loan.create.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        loan: {
          findFirst: sinon.stub().resolves(null),
          create: sinon.stub().rejects(new Error("Connection failed"))
        }
      };
      const createLoan = createCreateLoan(mockClient as any);

      // Act & Assert
      try {
        await createLoan(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Connection failed");
      }
    });
  });
});
