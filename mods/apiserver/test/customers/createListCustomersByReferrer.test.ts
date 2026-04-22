/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createListCustomersByReferrer } from "../../src/api/customers/createListCustomersByReferrer.js";
import { ValidationError } from "@mikro/common";

describe("createListCustomersByReferrer", () => {
  const validReferrerId = "550e8400-e29b-41d4-a716-446655440000";

  const createMockCustomer = (id: string, name: string) => ({
    id,
    name,
    phone: "+1234567890",
    idNumber: "ABC123",
    collectionPoint: "Main Office",
    homeAddress: "123 Main St",
    jobPosition: null,
    income: null,
    isBusinessOwner: false,
    isActive: true,
    idCardOnRecord: false,
    createdById: null,
    referredById: validReferrerId,
    assignedCollectorId: null,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should return customers referred by the specified user", async () => {
      // Arrange
      const expectedCustomers = [
        createMockCustomer("customer-1", "John Doe"),
        createMockCustomer("customer-2", "Jane Smith")
      ];
      const mockClient = {
        customer: {
          findMany: sinon.stub().resolves(expectedCustomers)
        }
      };
      const listCustomersByReferrer = createListCustomersByReferrer(mockClient as any);

      // Act
      const result = await listCustomersByReferrer({ referredById: validReferrerId });

      // Assert
      expect(result).to.have.length(2);
      expect(mockClient.customer.findMany.calledOnce).to.be.true;
      const findArg0 = mockClient.customer.findMany.firstCall.args[0];
      expect(findArg0.where).to.deep.equal({ referredById: validReferrerId, isActive: true });
      expect(findArg0.take).to.be.undefined;
      expect(findArg0.skip).to.be.undefined;
      expect(findArg0.include).to.deep.equal({ notificationPolicy: true });
    });

    it("should return customers with pagination", async () => {
      // Arrange
      const expectedCustomers = [createMockCustomer("customer-1", "John Doe")];
      const mockClient = {
        customer: {
          findMany: sinon.stub().resolves(expectedCustomers)
        }
      };
      const listCustomersByReferrer = createListCustomersByReferrer(mockClient as any);

      // Act
      const result = await listCustomersByReferrer({
        referredById: validReferrerId,
        limit: 10,
        offset: 5
      });

      // Assert
      expect(result).to.have.length(1);
      const findArg1 = mockClient.customer.findMany.firstCall.args[0];
      expect(findArg1.where).to.deep.equal({ referredById: validReferrerId, isActive: true });
      expect(findArg1.take).to.equal(10);
      expect(findArg1.skip).to.equal(5);
      expect(findArg1.include).to.deep.equal({ notificationPolicy: true });
    });

    it("should return empty array when no customers found", async () => {
      // Arrange
      const mockClient = {
        customer: {
          findMany: sinon.stub().resolves([])
        }
      };
      const listCustomersByReferrer = createListCustomersByReferrer(mockClient as any);

      // Act
      const result = await listCustomersByReferrer({ referredById: validReferrerId });

      // Assert
      expect(result).to.be.an("array").that.is.empty;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for invalid referrer UUID", async () => {
      // Arrange
      const mockClient = {
        customer: { findMany: sinon.stub() }
      };
      const listCustomersByReferrer = createListCustomersByReferrer(mockClient as any);

      // Act & Assert
      try {
        await listCustomersByReferrer({ referredById: "invalid-uuid" });
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
      const listCustomersByReferrer = createListCustomersByReferrer(mockClient as any);

      // Act & Assert
      try {
        await listCustomersByReferrer({} as any);
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
      const listCustomersByReferrer = createListCustomersByReferrer(mockClient as any);

      // Act & Assert
      try {
        await listCustomersByReferrer({ referredById: validReferrerId });
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Database error");
      }
    });
  });
});
