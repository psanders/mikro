/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createListLoansByReferrer } from "../../src/api/loans/createListLoansByReferrer.js";
import { ValidationError } from "@mikro/common";

describe("createListLoansByReferrer", () => {
  const validReferrerId = "550e8400-e29b-41d4-a716-446655440000";
  const validInput = {
    referredById: validReferrerId
  };

  const createMockLoan = (id: string, loanId: number) => ({
    id,
    loanId,
    type: "SAN" as const,
    status: "ACTIVE" as const,
    principal: 5000,
    termLength: 10,
    paymentAmount: 650,
    paymentFrequency: "WEEKLY" as const,
    memberId: "member-123",
    startedAt: new Date(),
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should return loans for referrer (ACTIVE only by default)", async () => {
      // Arrange
      const expectedLoans = [createMockLoan("loan-1", 10000), createMockLoan("loan-2", 10001)];
      const mockClient = {
        loan: {
          findMany: sinon.stub().resolves(expectedLoans)
        }
      };
      const listLoansByReferrer = createListLoansByReferrer(mockClient as any);

      // Act
      const result = await listLoansByReferrer(validInput);

      // Assert
      expect(result).to.have.length(2);
      expect(mockClient.loan.findMany.calledOnce).to.be.true;
      expect(
        mockClient.loan.findMany.calledWith({
          where: {
            member: {
              referredById: validReferrerId
            },
            status: "ACTIVE"
          },
          take: undefined,
          skip: undefined
        })
      ).to.be.true;
    });

    it("should return all loans when showAll is true", async () => {
      // Arrange
      const expectedLoans = [createMockLoan("loan-1", 10000)];
      const mockClient = {
        loan: {
          findMany: sinon.stub().resolves(expectedLoans)
        }
      };
      const listLoansByReferrer = createListLoansByReferrer(mockClient as any);

      // Act
      const result = await listLoansByReferrer({ ...validInput, showAll: true });

      // Assert
      expect(result).to.have.length(1);
      expect(
        mockClient.loan.findMany.calledWith({
          where: {
            member: {
              referredById: validReferrerId
            }
          },
          take: undefined,
          skip: undefined
        })
      ).to.be.true;
    });

    it("should apply pagination when limit and offset provided", async () => {
      // Arrange
      const expectedLoans = [createMockLoan("loan-2", 10001)];
      const mockClient = {
        loan: {
          findMany: sinon.stub().resolves(expectedLoans)
        }
      };
      const listLoansByReferrer = createListLoansByReferrer(mockClient as any);

      // Act
      const result = await listLoansByReferrer({
        ...validInput,
        limit: 10,
        offset: 1
      });

      // Assert
      expect(result).to.have.length(1);
      expect(
        mockClient.loan.findMany.calledWith({
          where: {
            member: {
              referredById: validReferrerId
            },
            status: "ACTIVE"
          },
          take: 10,
          skip: 1
        })
      ).to.be.true;
    });

    it("should return empty array when no loans exist", async () => {
      // Arrange
      const mockClient = {
        loan: {
          findMany: sinon.stub().resolves([])
        }
      };
      const listLoansByReferrer = createListLoansByReferrer(mockClient as any);

      // Act
      const result = await listLoansByReferrer(validInput);

      // Assert
      expect(result).to.be.an("array").that.is.empty;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for invalid UUID", async () => {
      // Arrange
      const mockClient = {
        loan: { findMany: sinon.stub() }
      };
      const listLoansByReferrer = createListLoansByReferrer(mockClient as any);

      // Act & Assert
      try {
        await listLoansByReferrer({ referredById: "not-a-valid-uuid" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.loan.findMany.called).to.be.false;
      }
    });

    it("should throw ValidationError for negative offset", async () => {
      // Arrange
      const mockClient = {
        loan: { findMany: sinon.stub() }
      };
      const listLoansByReferrer = createListLoansByReferrer(mockClient as any);

      // Act & Assert
      try {
        await listLoansByReferrer({ ...validInput, offset: -1 });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.loan.findMany.called).to.be.false;
      }
    });

    it("should throw ValidationError for limit exceeding max", async () => {
      // Arrange
      const mockClient = {
        loan: { findMany: sinon.stub() }
      };
      const listLoansByReferrer = createListLoansByReferrer(mockClient as any);

      // Act & Assert
      try {
        await listLoansByReferrer({ ...validInput, limit: 101 });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.loan.findMany.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        loan: {
          findMany: sinon.stub().rejects(new Error("Database error"))
        }
      };
      const listLoansByReferrer = createListLoansByReferrer(mockClient as any);

      // Act & Assert
      try {
        await listLoansByReferrer(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Database error");
      }
    });
  });
});
