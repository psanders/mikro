/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createGetMember } from "../../src/api/members/createGetMember.js";
import { ValidationError } from "@mikro/common";

describe("createGetMember", () => {
  const validInput = {
    id: "550e8400-e29b-41d4-a716-446655440000",
  };

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should return a member when found", async () => {
      // Arrange
      const expectedMember = {
        id: validInput.id,
        name: "John Doe",
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
          findUnique: sinon.stub().resolves(expectedMember),
        },
      };
      const getMember = createGetMember(mockClient as any);

      // Act
      const result = await getMember(validInput);

      // Assert
      expect(result).to.deep.equal(expectedMember);
      expect(mockClient.member.findUnique.calledOnce).to.be.true;
      expect(
        mockClient.member.findUnique.calledWith({
          where: { id: validInput.id },
        })
      ).to.be.true;
    });

    it("should return null when member not found", async () => {
      // Arrange
      const mockClient = {
        member: {
          findUnique: sinon.stub().resolves(null),
        },
      };
      const getMember = createGetMember(mockClient as any);

      // Act
      const result = await getMember(validInput);

      // Assert
      expect(result).to.be.null;
      expect(mockClient.member.findUnique.calledOnce).to.be.true;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for invalid UUID", async () => {
      // Arrange
      const mockClient = {
        member: { findUnique: sinon.stub() },
      };
      const getMember = createGetMember(mockClient as any);

      // Act & Assert
      try {
        await getMember({ id: "not-a-valid-uuid" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.member.findUnique.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        member: {
          findUnique: sinon.stub().rejects(new Error("Database error")),
        },
      };
      const getMember = createGetMember(mockClient as any);

      // Act & Assert
      try {
        await getMember(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Database error");
      }
    });
  });
});
