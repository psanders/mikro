/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createUpdateMember } from "../../src/api/members/createUpdateMember.js";
import { ValidationError } from "@mikro/common";

describe("createUpdateMember", () => {
  const validInput = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Updated Name",
    phone: "+0987654321",
    isActive: false,
  };

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should update a member with all allowed fields", async () => {
      // Arrange
      const expectedMember = {
        id: validInput.id,
        name: validInput.name,
        phone: validInput.phone,
        idNumber: "ABC123",
        collectionPoint: "Main Office",
        homeAddress: "123 Main St",
        jobPosition: null,
        income: null,
        isBusinessOwner: false,
        isActive: validInput.isActive,
        idCardOnRecord: false,
        createdById: null,
        referredById: null,
        assignedCollectorId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockClient = {
        member: {
          update: sinon.stub().resolves(expectedMember),
        },
      };
      const updateMember = createUpdateMember(mockClient as any);

      // Act
      const result = await updateMember(validInput);

      // Assert
      expect(result.id).to.equal(validInput.id);
      expect(result.name).to.equal(validInput.name);
      expect(result.isActive).to.be.false;
      expect(mockClient.member.update.calledOnce).to.be.true;
    });

    it("should update a member with partial fields", async () => {
      // Arrange
      const partialInput = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        isActive: true,
      };
      const expectedMember = {
        id: partialInput.id,
        name: "Existing Name",
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
        updatedAt: new Date(),
      };
      const mockClient = {
        member: {
          update: sinon.stub().resolves(expectedMember),
        },
      };
      const updateMember = createUpdateMember(mockClient as any);

      // Act
      const result = await updateMember(partialInput);

      // Assert
      expect(result.isActive).to.be.true;
      expect(mockClient.member.update.calledOnce).to.be.true;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for invalid UUID", async () => {
      // Arrange
      const mockClient = {
        member: { update: sinon.stub() },
      };
      const updateMember = createUpdateMember(mockClient as any);

      // Act & Assert
      try {
        await updateMember({ id: "invalid-uuid", name: "Test" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.member.update.called).to.be.false;
      }
    });

    it("should throw ValidationError for empty name when provided", async () => {
      // Arrange
      const mockClient = {
        member: { update: sinon.stub() },
      };
      const updateMember = createUpdateMember(mockClient as any);

      // Act & Assert
      try {
        await updateMember({
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "",
        });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.member.update.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        member: {
          update: sinon.stub().rejects(new Error("Member not found")),
        },
      };
      const updateMember = createUpdateMember(mockClient as any);

      // Act & Assert
      try {
        await updateMember(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Member not found");
      }
    });
  });
});
