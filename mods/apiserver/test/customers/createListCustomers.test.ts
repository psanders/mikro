/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createListCustomers } from "../../src/api/customers/createListCustomers.js";
import { ValidationError } from "@mikro/common";

describe("createListCustomers", () => {
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
    referredById: null,
    assignedCollectorId: null,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should return all customers without pagination", async () => {
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
      const listCustomers = createListCustomers(mockClient as any);

      // Act
      const result = await listCustomers({});

      // Assert
      expect(result).to.have.length(2);
      expect(result[0].name).to.equal("John Doe");
      expect(mockClient.customer.findMany.calledOnce).to.be.true;
    });

    it("should return customers with pagination", async () => {
      // Arrange
      const expectedCustomers = [createMockCustomer("customer-2", "Jane Smith")];
      const mockClient = {
        customer: {
          findMany: sinon.stub().resolves(expectedCustomers)
        }
      };
      const listCustomers = createListCustomers(mockClient as any);

      // Act
      const result = await listCustomers({ limit: 10, offset: 1 });

      // Assert
      expect(result).to.have.length(1);
      expect(mockClient.customer.findMany.calledOnce).to.be.true;
      const findArg = mockClient.customer.findMany.firstCall.args[0];
      expect(findArg.where).to.deep.equal({ isActive: true });
      expect(findArg.take).to.equal(10);
      expect(findArg.skip).to.equal(1);
    });

    it("should return empty array when no customers exist", async () => {
      // Arrange
      const mockClient = {
        customer: {
          findMany: sinon.stub().resolves([])
        }
      };
      const listCustomers = createListCustomers(mockClient as any);

      // Act
      const result = await listCustomers({});

      // Assert
      expect(result).to.be.an("array").that.is.empty;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for negative offset", async () => {
      // Arrange
      const mockClient = {
        customer: { findMany: sinon.stub() }
      };
      const listCustomers = createListCustomers(mockClient as any);

      // Act & Assert
      try {
        await listCustomers({ offset: -1 });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.customer.findMany.called).to.be.false;
      }
    });

    it("should throw ValidationError for limit exceeding max", async () => {
      // Arrange
      const mockClient = {
        customer: { findMany: sinon.stub() }
      };
      const listCustomers = createListCustomers(mockClient as any);

      // Act & Assert
      try {
        await listCustomers({ limit: 101 });
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
      const listCustomers = createListCustomers(mockClient as any);

      // Act & Assert
      try {
        await listCustomers({});
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Database error");
      }
    });
  });
});
