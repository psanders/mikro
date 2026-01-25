/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createGetMemberByPhone } from "../../src/api/members/createGetMemberByPhone.js";
import { ValidationError } from "@mikro/common";

describe("createGetMemberByPhone", () => {
  const validInput = {
    phone: "+18091234567"
  };

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should return a member when found", async () => {
      // Arrange
      const expectedMember = {
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
        member: {
          findFirst: sinon.stub().resolves(expectedMember)
        }
      };
      const getMemberByPhone = createGetMemberByPhone(mockClient as any);

      // Act
      const result = await getMemberByPhone(validInput);

      // Assert
      expect(result).to.deep.equal(expectedMember);
      expect(mockClient.member.findFirst.calledOnce).to.be.true;
      expect(
        mockClient.member.findFirst.calledWith({
          where: { phone: validInput.phone }
        })
      ).to.be.true;
    });

    it("should return null when member not found", async () => {
      // Arrange
      const mockClient = {
        member: {
          findFirst: sinon.stub().resolves(null)
        }
      };
      const getMemberByPhone = createGetMemberByPhone(mockClient as any);

      // Act
      const result = await getMemberByPhone(validInput);

      // Assert
      expect(result).to.be.null;
      expect(mockClient.member.findFirst.calledOnce).to.be.true;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for empty phone", async () => {
      // Arrange
      const mockClient = {
        member: { findFirst: sinon.stub() }
      };
      const getMemberByPhone = createGetMemberByPhone(mockClient as any);

      // Act & Assert
      try {
        await getMemberByPhone({ phone: "" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.member.findFirst.called).to.be.false;
      }
    });

    it("should throw ValidationError for missing phone", async () => {
      // Arrange
      const mockClient = {
        member: { findFirst: sinon.stub() }
      };
      const getMemberByPhone = createGetMemberByPhone(mockClient as any);

      // Act & Assert
      try {
        await getMemberByPhone({} as any);
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.member.findFirst.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        member: {
          findFirst: sinon.stub().rejects(new Error("Database error"))
        }
      };
      const getMemberByPhone = createGetMemberByPhone(mockClient as any);

      // Act & Assert
      try {
        await getMemberByPhone(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Database error");
      }
    });
  });
});
