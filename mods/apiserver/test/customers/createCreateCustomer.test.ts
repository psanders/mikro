/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createCreateCustomer } from "../../src/api/customers/createCreateCustomer.js";
import { ValidationError } from "@mikro/common";

describe("createCreateCustomer", () => {
  const validReferrerId = "550e8400-e29b-41d4-a716-446655440000";
  const validCollectorId = "660e8400-e29b-41d4-a716-446655440001";
  const validInput = {
    name: "John Doe",
    phone: "+18091234567",
    idNumber: "001-1234567-8",
    collectionPoint: "https://example.com/main-office",
    homeAddress: "123 Main St",
    referredById: validReferrerId,
    assignedCollectorId: validCollectorId
  };

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should create a customer with required fields", async () => {
      // Arrange
      const expectedCustomer = {
        id: "customer-123",
        ...validInput,
        phone: "18091234567", // Normalized (stripped +)
        jobPosition: null,
        income: null,
        isBusinessOwner: false,
        isActive: true,
        idCardOnRecord: false,
        note: null,
        createdById: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const mockClient = {
        customer: {
          create: sinon.stub().resolves(expectedCustomer)
        }
      };
      const createCustomer = createCreateCustomer(mockClient as any);

      // Act
      const result = await createCustomer(validInput);

      // Assert
      expect(result.id).to.equal("customer-123");
      expect(result.name).to.equal(validInput.name);
      expect(mockClient.customer.create.calledOnce).to.be.true;
      // Phone gets normalized to E.164 format in the schema transform
      const callArgs = mockClient.customer.create.getCall(0).args[0];
      expect(callArgs.data.name).to.equal(validInput.name);
      expect(callArgs.data.phone).to.equal("+18091234567"); // Normalized to E.164 format
      expect(callArgs.data.idNumber).to.equal(validInput.idNumber);
    });

    it("should create a customer with optional fields", async () => {
      // Arrange
      const inputWithOptional = {
        ...validInput,
        jobPosition: "Engineer",
        income: 50000,
        isBusinessOwner: true,
        note: "Test note"
      };
      const expectedCustomer = {
        id: "customer-456",
        ...inputWithOptional,
        phone: "18091234567", // Normalized (stripped +)
        isActive: true,
        idCardOnRecord: false,
        createdById: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const mockClient = {
        customer: {
          create: sinon.stub().resolves(expectedCustomer)
        }
      };
      const createCustomer = createCreateCustomer(mockClient as any);

      // Act
      const result = await createCustomer(inputWithOptional);

      // Assert
      expect(result.id).to.equal("customer-456");
      expect(result.jobPosition).to.equal("Engineer");
      expect(mockClient.customer.create.calledOnce).to.be.true;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for missing required fields", async () => {
      // Arrange
      const mockClient = {
        customer: { create: sinon.stub() }
      };
      const createCustomer = createCreateCustomer(mockClient as any);

      // Act & Assert
      try {
        await createCustomer({ name: "John" } as any);
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.customer.create.called).to.be.false;
      }
    });

    it("should throw ValidationError for empty name", async () => {
      // Arrange
      const mockClient = {
        customer: { create: sinon.stub() }
      };
      const createCustomer = createCreateCustomer(mockClient as any);

      // Act & Assert
      try {
        await createCustomer({ ...validInput, name: "" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.customer.create.called).to.be.false;
      }
    });

    it("should throw ValidationError for invalid referredById UUID", async () => {
      // Arrange
      const mockClient = {
        customer: { create: sinon.stub() }
      };
      const createCustomer = createCreateCustomer(mockClient as any);

      // Act & Assert
      try {
        await createCustomer({ ...validInput, referredById: "invalid-uuid" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.customer.create.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        customer: {
          create: sinon.stub().rejects(new Error("Connection failed"))
        }
      };
      const createCustomer = createCreateCustomer(mockClient as any);

      // Act & Assert
      try {
        await createCustomer(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Connection failed");
      }
    });
  });
});
