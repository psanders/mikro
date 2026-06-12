/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createExportAllCustomers } from "../../src/api/customers/createExportAllCustomers.js";

describe("createExportAllCustomers", () => {
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
    ]
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should return all active customers with loans", async () => {
      // Arrange
      const expectedCustomers = [
        createMockCustomerWithLoans("customer-1", "John Doe"),
        createMockCustomerWithLoans("customer-2", "Jane Smith"),
        createMockCustomerWithLoans("customer-3", "Bob Wilson")
      ];
      const mockClient = {
        customer: {
          findMany: sinon.stub().resolves(expectedCustomers)
        }
      };
      const exportAllCustomers = createExportAllCustomers(mockClient as any);

      // Act
      const result = await exportAllCustomers({});

      // Assert
      expect(result).to.have.length(3);
      expect(result[0].loans).to.have.length(1);
      expect(mockClient.customer.findMany.calledOnce).to.be.true;

      const callArgs = mockClient.customer.findMany.firstCall.args[0];
      expect(callArgs.where.isActive).to.equal(true);
      expect(callArgs.include.loans).to.exist;
    });

    it("should return empty array when no customers found", async () => {
      // Arrange
      const mockClient = {
        customer: {
          findMany: sinon.stub().resolves([])
        }
      };
      const exportAllCustomers = createExportAllCustomers(mockClient as any);

      // Act
      const result = await exportAllCustomers({});

      // Assert
      expect(result).to.be.an("array").that.is.empty;
    });

    it("should only query for active customers", async () => {
      // Arrange
      const mockClient = {
        customer: {
          findMany: sinon.stub().resolves([])
        }
      };
      const exportAllCustomers = createExportAllCustomers(mockClient as any);

      // Act
      await exportAllCustomers({});

      // Assert
      const callArgs = mockClient.customer.findMany.firstCall.args[0];
      expect(callArgs.where.isActive).to.equal(true);
    });

    it("should only include active loans", async () => {
      // Arrange
      const mockClient = {
        customer: {
          findMany: sinon.stub().resolves([])
        }
      };
      const exportAllCustomers = createExportAllCustomers(mockClient as any);

      // Act
      await exportAllCustomers({});

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
      const exportAllCustomers = createExportAllCustomers(mockClient as any);

      // Act
      await exportAllCustomers({});

      // Assert
      const callArgs = mockClient.customer.findMany.firstCall.args[0];
      expect(callArgs.include.loans.include.payments.where.status).to.equal("COMPLETED");
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
      const exportAllCustomers = createExportAllCustomers(mockClient as any);

      // Act & Assert
      try {
        await exportAllCustomers({});
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Database error");
      }
    });
  });
});
