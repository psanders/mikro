/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createListLoans } from "../../src/api/loans/createListLoans.js";
import { ValidationError } from "@mikro/common";

describe("createListLoans", () => {
  const validInput = {};

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
    it("should return ACTIVE loans by default", async () => {
      // Arrange
      const expectedLoans = [createMockLoan("loan-1", 10000), createMockLoan("loan-2", 10001)];
      const mockClient = {
        loan: {
          findMany: sinon.stub().resolves(expectedLoans)
        }
      };
      const listLoans = createListLoans(mockClient as any);

      // Act
      const result = await listLoans(validInput);

      // Assert
      expect(result).to.have.length(2);
      expect(mockClient.loan.findMany.calledOnce).to.be.true;
      expect(
        mockClient.loan.findMany.calledWith({
          where: { status: "ACTIVE" },
          include: {
            member: {
              select: {
                name: true,
                phone: true
              }
            }
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
      const listLoans = createListLoans(mockClient as any);

      // Act
      const result = await listLoans({ showAll: true });

      // Assert
      expect(result).to.have.length(1);
      expect(
        mockClient.loan.findMany.calledWith({
          where: undefined,
          include: {
            member: {
              select: {
                name: true,
                phone: true
              }
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
      const listLoans = createListLoans(mockClient as any);

      // Act
      const result = await listLoans({
        limit: 10,
        offset: 1
      });

      // Assert
      expect(result).to.have.length(1);
      expect(
        mockClient.loan.findMany.calledWith({
          where: { status: "ACTIVE" },
          include: {
            member: {
              select: {
                name: true,
                phone: true
              }
            }
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
      const listLoans = createListLoans(mockClient as any);

      // Act
      const result = await listLoans(validInput);

      // Assert
      expect(result).to.be.an("array").that.is.empty;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for negative offset", async () => {
      // Arrange
      const mockClient = {
        loan: { findMany: sinon.stub() }
      };
      const listLoans = createListLoans(mockClient as any);

      // Act & Assert
      try {
        await listLoans({ offset: -1 });
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
      const listLoans = createListLoans(mockClient as any);

      // Act & Assert
      try {
        await listLoans({ limit: 101 });
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
      const listLoans = createListLoans(mockClient as any);

      // Act & Assert
      try {
        await listLoans(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Database error");
      }
    });
  });
});
