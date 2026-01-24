/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createListMembersByCollector } from "../../src/api/members/createListMembersByCollector.js";
import { ValidationError } from "@mikro/common";

describe("createListMembersByCollector", () => {
  const validCollectorId = "550e8400-e29b-41d4-a716-446655440000";

  const createMockMember = (id: string, name: string) => ({
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
    assignedCollectorId: validCollectorId,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should return members assigned to the specified collector", async () => {
      // Arrange
      const expectedMembers = [
        createMockMember("member-1", "John Doe"),
        createMockMember("member-2", "Jane Smith")
      ];
      const mockClient = {
        member: {
          findMany: sinon.stub().resolves(expectedMembers)
        }
      };
      const listMembersByCollector = createListMembersByCollector(mockClient as any);

      // Act
      const result = await listMembersByCollector({ assignedCollectorId: validCollectorId });

      // Assert
      expect(result).to.have.length(2);
      expect(mockClient.member.findMany.calledOnce).to.be.true;
      expect(
        mockClient.member.findMany.calledWith({
          where: { assignedCollectorId: validCollectorId, isActive: true },
          take: undefined,
          skip: undefined
        })
      ).to.be.true;
    });

    it("should return members with pagination", async () => {
      // Arrange
      const expectedMembers = [createMockMember("member-1", "John Doe")];
      const mockClient = {
        member: {
          findMany: sinon.stub().resolves(expectedMembers)
        }
      };
      const listMembersByCollector = createListMembersByCollector(mockClient as any);

      // Act
      const result = await listMembersByCollector({
        assignedCollectorId: validCollectorId,
        limit: 10,
        offset: 5
      });

      // Assert
      expect(result).to.have.length(1);
      expect(
        mockClient.member.findMany.calledWith({
          where: { assignedCollectorId: validCollectorId, isActive: true },
          take: 10,
          skip: 5
        })
      ).to.be.true;
    });

    it("should return empty array when no members found", async () => {
      // Arrange
      const mockClient = {
        member: {
          findMany: sinon.stub().resolves([])
        }
      };
      const listMembersByCollector = createListMembersByCollector(mockClient as any);

      // Act
      const result = await listMembersByCollector({ assignedCollectorId: validCollectorId });

      // Assert
      expect(result).to.be.an("array").that.is.empty;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for invalid collector UUID", async () => {
      // Arrange
      const mockClient = {
        member: { findMany: sinon.stub() }
      };
      const listMembersByCollector = createListMembersByCollector(mockClient as any);

      // Act & Assert
      try {
        await listMembersByCollector({ assignedCollectorId: "invalid-uuid" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.member.findMany.called).to.be.false;
      }
    });

    it("should throw ValidationError for missing assignedCollectorId", async () => {
      // Arrange
      const mockClient = {
        member: { findMany: sinon.stub() }
      };
      const listMembersByCollector = createListMembersByCollector(mockClient as any);

      // Act & Assert
      try {
        await listMembersByCollector({} as any);
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.member.findMany.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        member: {
          findMany: sinon.stub().rejects(new Error("Database error"))
        }
      };
      const listMembersByCollector = createListMembersByCollector(mockClient as any);

      // Act & Assert
      try {
        await listMembersByCollector({ assignedCollectorId: validCollectorId });
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Database error");
      }
    });
  });
});
