/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createExportCustomersByReferrer } from "../../src/api/customers/createExportCustomersByReferrer.js";
import { ValidationError } from "@mikro/common";

describe("createExportCustomersByReferrer", () => {
  const validReferrerId = "550e8400-e29b-41d4-a716-446655440000";

  const createMockCustomerWithLoans = (id: string, name: string) => ({
    id,
    name,
    phone: "+1234567890",
    idNumber: "ABC123",
    collectionPoint: "https://maps.google.com/place",
    homeAddress: "123 Main St",
    jobPosition: null,
    income: null,
    isBusinessOwner: false,
    isActive: true,
    idCardOnRecord: false,
    notes: "Test notes",
    createdById: null,
    referredById: validReferrerId,
    assignedCollectorId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    loans: [
      {
        id: "loan-1",
        loanId: 10001,
        type: "SAN",
        status: "ACTIVE",
        principal: 5000,
        termLength: 10,
        paymentAmount: 550,
        paymentFrequency: "WEEKLY",
        notes: null,
        customerId: id,
        createdAt: new Date(),
        updatedAt: new Date(),
        payments: [
          {
            id: "payment-1",
            amount: 550,
            paidAt: new Date(),
            method: "CASH",
            status: "COMPLETED",
            notes: null,
            loanId: "loan-1",
            collectedById: null,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        ]
      }
    ],
    referredBy: { name: "John Referrer" }
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should return customers referred by the specified user with loans", async () => {
      // Arrange
      const expectedCustomers = [
        createMockCustomerWithLoans("customer-1", "John Doe"),
        createMockCustomerWithLoans("customer-2", "Jane Smith")
      ];
      const mockClient = {
        customer: {
          findMany: sinon.stub().resolves(expectedCustomers)
        }
      };
      const exportCustomersByReferrer = createExportCustomersByReferrer(mockClient as any);

      // Act
      const result = await exportCustomersByReferrer({ referredById: validReferrerId });

      // Assert
      expect(result).to.have.length(2);
      expect(result[0].loans).to.have.length(1);
      expect(result[0].referredBy!.name).to.equal("John Referrer");
      expect(mockClient.customer.findMany.calledOnce).to.be.true;

      const callArgs = mockClient.customer.findMany.firstCall.args[0];
      expect(callArgs.where.referredById).to.equal(validReferrerId);
      expect(callArgs.where.isActive).to.equal(true);
      expect(callArgs.include.loans).to.exist;
      expect(callArgs.include.referredBy).to.exist;
    });

    it("should return empty array when no customers found", async () => {
      // Arrange
      const mockClient = {
        customer: {
          findMany: sinon.stub().resolves([])
        }
      };
      const exportCustomersByReferrer = createExportCustomersByReferrer(mockClient as any);

      // Act
      const result = await exportCustomersByReferrer({ referredById: validReferrerId });

      // Assert
      expect(result).to.be.an("array").that.is.empty;
    });

    it("should only include active loans", async () => {
      // Arrange
      const mockClient = {
        customer: {
          findMany: sinon.stub().resolves([])
        }
      };
      const exportCustomersByReferrer = createExportCustomersByReferrer(mockClient as any);

      // Act
      await exportCustomersByReferrer({ referredById: validReferrerId });

      // Assert
      const callArgs = mockClient.customer.findMany.firstCall.args[0];
      expect(callArgs.include.loans.where.status).to.equal("ACTIVE");
    });

    it("should only include completed payments", async () => {
      // Arrange
      const mockClient = {
        customer: {
          findMany: sinon.stub().resolves([])
        }
      };
      const exportCustomersByReferrer = createExportCustomersByReferrer(mockClient as any);

      // Act
      await exportCustomersByReferrer({ referredById: validReferrerId });

      // Assert
      const callArgs = mockClient.customer.findMany.firstCall.args[0];
      expect(callArgs.include.loans.include.payments.where.status).to.equal("COMPLETED");
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for invalid referrer UUID", async () => {
      // Arrange
      const mockClient = {
        customer: { findMany: sinon.stub() }
      };
      const exportCustomersByReferrer = createExportCustomersByReferrer(mockClient as any);

      // Act & Assert
      try {
        await exportCustomersByReferrer({ referredById: "invalid-uuid" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.customer.findMany.called).to.be.false;
      }
    });

    it("should throw ValidationError for missing referredById", async () => {
      // Arrange
      const mockClient = {
        customer: { findMany: sinon.stub() }
      };
      const exportCustomersByReferrer = createExportCustomersByReferrer(mockClient as any);

      // Act & Assert
      try {
        await exportCustomersByReferrer({} as any);
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.customer.findMany.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        customer: {
          findMany: sinon.stub().rejects(new Error("Database error"))
        }
      };
      const exportCustomersByReferrer = createExportCustomersByReferrer(mockClient as any);

      // Act & Assert
      try {
        await exportCustomersByReferrer({ referredById: validReferrerId });
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Database error");
      }
    });
  });
});
