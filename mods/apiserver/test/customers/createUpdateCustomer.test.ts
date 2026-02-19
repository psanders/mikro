/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createUpdateCustomer } from "../../src/api/customers/createUpdateCustomer.js";
import { ValidationError } from "@mikro/common";

describe("createUpdateCustomer", () => {
  const validInput = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Updated Name",
    phone: "+18091234567",
    isActive: false
  };

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should update a customer with all allowed fields", async () => {
      // Arrange
      const expectedCustomer = {
        id: validInput.id,
        name: validInput.name,
        phone: "18091234567", // Normalized (stripped +)
        idNumber: "001-1234567-8",
        collectionPoint: "https://example.com/main-office",
        homeAddress: "123 Main St",
        jobPosition: null,
        income: null,
        isBusinessOwner: false,
        isActive: validInput.isActive,
        idCardOnRecord: false,
        note: null,
        referredById: "550e8400-e29b-41d4-a716-446655440001",
        assignedCollectorId: "550e8400-e29b-41d4-a716-446655440002",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const mockClient = {
        customer: {
          update: sinon.stub().resolves(expectedCustomer)
        }
      };
      const updateCustomer = createUpdateCustomer(mockClient as any);

      // Act
      const result = await updateCustomer(validInput);

      // Assert
      expect(result.id).to.equal(validInput.id);
      expect(result.name).to.equal(validInput.name);
      expect(result.isActive).to.be.false;
      expect(mockClient.customer.update.calledOnce).to.be.true;
    });

    it("should update a customer with partial fields", async () => {
      // Arrange
      const partialInput = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        isActive: true
      };
      const expectedCustomer = {
        id: partialInput.id,
        name: "Existing Name",
        phone: "18091234567",
        idNumber: "001-1234567-8",
        collectionPoint: "https://example.com/main-office",
        homeAddress: "123 Main St",
        jobPosition: null,
        income: null,
        isBusinessOwner: false,
        isActive: true,
        idCardOnRecord: false,
        note: null,
        referredById: "550e8400-e29b-41d4-a716-446655440001",
        assignedCollectorId: "550e8400-e29b-41d4-a716-446655440002",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const mockClient = {
        customer: {
          update: sinon.stub().resolves(expectedCustomer)
        }
      };
      const updateCustomer = createUpdateCustomer(mockClient as any);

      // Act
      const result = await updateCustomer(partialInput);

      // Assert
      expect(result.isActive).to.be.true;
      expect(mockClient.customer.update.calledOnce).to.be.true;
    });

    it("should update a customer with note field", async () => {
      // Arrange
      const inputWithNote = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        note: "Updated note"
      };
      const expectedCustomer = {
        id: inputWithNote.id,
        name: "Existing Name",
        phone: "18091234567",
        idNumber: "001-1234567-8",
        collectionPoint: "https://example.com/main-office",
        homeAddress: "123 Main St",
        jobPosition: null,
        income: null,
        isBusinessOwner: false,
        isActive: true,
        idCardOnRecord: false,
        note: "Updated note",
        referredById: "550e8400-e29b-41d4-a716-446655440001",
        assignedCollectorId: "550e8400-e29b-41d4-a716-446655440002",
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const mockClient = {
        customer: {
          update: sinon.stub().resolves(expectedCustomer)
        }
      };
      const updateCustomer = createUpdateCustomer(mockClient as any);

      // Act
      const result = await updateCustomer(inputWithNote);

      // Assert
      expect(result.note).to.equal("Updated note");
      expect(mockClient.customer.update.calledOnce).to.be.true;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for invalid UUID", async () => {
      // Arrange
      const mockClient = {
        customer: { update: sinon.stub() }
      };
      const updateCustomer = createUpdateCustomer(mockClient as any);

      // Act & Assert
      try {
        await updateCustomer({ id: "invalid-uuid", name: "Test" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.customer.update.called).to.be.false;
      }
    });

    it("should throw ValidationError for empty name when provided", async () => {
      // Arrange
      const mockClient = {
        customer: { update: sinon.stub() }
      };
      const updateCustomer = createUpdateCustomer(mockClient as any);

      // Act & Assert
      try {
        await updateCustomer({
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: ""
        });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.customer.update.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        customer: {
          update: sinon.stub().rejects(new Error("Customer not found"))
        }
      };
      const updateCustomer = createUpdateCustomer(mockClient as any);

      // Act & Assert
      try {
        await updateCustomer(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Customer not found");
      }
    });
  });
});
