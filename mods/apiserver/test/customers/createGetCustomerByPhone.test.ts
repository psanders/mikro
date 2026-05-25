/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createGetCustomerByPhone } from "../../src/api/customers/createGetCustomerByPhone.js";
import { ValidationError } from "@mikro/common";

describe("createGetCustomerByPhone", () => {
  const validInput = {
    phone: "+18091234567"
  };

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should return a customer when found", async () => {
      // Arrange
      const expectedCustomer = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "John Doe",
        phone: "+18091234567",
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
      };
      const mockClient = {
        customer: {
          findFirst: sinon.stub().resolves(expectedCustomer)
        }
      };
      const getCustomerByPhone = createGetCustomerByPhone(mockClient as any);

      // Act
      const result = await getCustomerByPhone(validInput);

      // Assert
      expect(result).to.deep.equal(expectedCustomer);
      expect(mockClient.customer.findFirst.calledOnce).to.be.true;
      const findArg = mockClient.customer.findFirst.firstCall.args[0];
      expect(findArg.where).to.deep.equal({ phone: validInput.phone });
    });

    it("should return null when customer not found", async () => {
      // Arrange
      const mockClient = {
        customer: {
          findFirst: sinon.stub().resolves(null)
        }
      };
      const getCustomerByPhone = createGetCustomerByPhone(mockClient as any);

      // Act
      const result = await getCustomerByPhone(validInput);

      // Assert
      expect(result).to.be.null;
      expect(mockClient.customer.findFirst.calledOnce).to.be.true;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for empty phone", async () => {
      // Arrange
      const mockClient = {
        customer: { findFirst: sinon.stub() }
      };
      const getCustomerByPhone = createGetCustomerByPhone(mockClient as any);

      // Act & Assert
      try {
        await getCustomerByPhone({ phone: "" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.customer.findFirst.called).to.be.false;
      }
    });

    it("should throw ValidationError for missing phone", async () => {
      // Arrange
      const mockClient = {
        customer: { findFirst: sinon.stub() }
      };
      const getCustomerByPhone = createGetCustomerByPhone(mockClient as any);

      // Act & Assert
      try {
        await getCustomerByPhone({} as any);
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.customer.findFirst.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        customer: {
          findFirst: sinon.stub().rejects(new Error("Database error"))
        }
      };
      const getCustomerByPhone = createGetCustomerByPhone(mockClient as any);

      // Act & Assert
      try {
        await getCustomerByPhone(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Database error");
      }
    });
  });
});
