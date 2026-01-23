/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createCreateMember } from "../../src/api/members/createCreateMember.js";
import { ValidationError } from "@mikro/common";

describe("createCreateMember", () => {
  const validInput = {
    name: "John Doe",
    phone: "+1234567890",
    idNumber: "ABC123",
    collectionPoint: "Main Office",
    homeAddress: "123 Main St",
  };

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should create a member with required fields", async () => {
      // Arrange
      const expectedMember = {
        id: "member-123",
        ...validInput,
        jobPosition: null,
        income: null,
        isBusinessOwner: false,
        isActive: true,
        idCardOnRecord: false,
        createdById: null,
        referredById: null,
        assignedCollectorId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockClient = {
        member: {
          create: sinon.stub().resolves(expectedMember),
        },
      };
      const createMember = createCreateMember(mockClient as any);

      // Act
      const result = await createMember(validInput);

      // Assert
      expect(result.id).to.equal("member-123");
      expect(result.name).to.equal(validInput.name);
      expect(mockClient.member.create.calledOnce).to.be.true;
      expect(
        mockClient.member.create.calledWith({ data: validInput })
      ).to.be.true;
    });

    it("should create a member with optional fields", async () => {
      // Arrange
      const inputWithOptional = {
        ...validInput,
        jobPosition: "Engineer",
        income: 50000,
        isBusinessOwner: true,
        referredById: "550e8400-e29b-41d4-a716-446655440000",
      };
      const expectedMember = {
        id: "member-456",
        ...inputWithOptional,
        isActive: true,
        idCardOnRecord: false,
        createdById: null,
        assignedCollectorId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockClient = {
        member: {
          create: sinon.stub().resolves(expectedMember),
        },
      };
      const createMember = createCreateMember(mockClient as any);

      // Act
      const result = await createMember(inputWithOptional);

      // Assert
      expect(result.id).to.equal("member-456");
      expect(result.jobPosition).to.equal("Engineer");
      expect(mockClient.member.create.calledOnce).to.be.true;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for missing required fields", async () => {
      // Arrange
      const mockClient = {
        member: { create: sinon.stub() },
      };
      const createMember = createCreateMember(mockClient as any);

      // Act & Assert
      try {
        await createMember({ name: "John" } as any);
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.member.create.called).to.be.false;
      }
    });

    it("should throw ValidationError for empty name", async () => {
      // Arrange
      const mockClient = {
        member: { create: sinon.stub() },
      };
      const createMember = createCreateMember(mockClient as any);

      // Act & Assert
      try {
        await createMember({ ...validInput, name: "" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.member.create.called).to.be.false;
      }
    });

    it("should throw ValidationError for invalid referredById UUID", async () => {
      // Arrange
      const mockClient = {
        member: { create: sinon.stub() },
      };
      const createMember = createCreateMember(mockClient as any);

      // Act & Assert
      try {
        await createMember({ ...validInput, referredById: "invalid-uuid" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.member.create.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        member: {
          create: sinon.stub().rejects(new Error("Connection failed")),
        },
      };
      const createMember = createCreateMember(mockClient as any);

      // Act & Assert
      try {
        await createMember(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Connection failed");
      }
    });
  });
});
