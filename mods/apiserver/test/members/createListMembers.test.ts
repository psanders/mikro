/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createListMembers } from "../../src/api/members/createListMembers.js";
import { ValidationError } from "@mikro/common";

describe("createListMembers", () => {
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
    assignedCollectorId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should return all members without pagination", async () => {
      // Arrange
      const expectedMembers = [
        createMockMember("member-1", "John Doe"),
        createMockMember("member-2", "Jane Smith"),
      ];
      const mockClient = {
        member: {
          findMany: sinon.stub().resolves(expectedMembers),
        },
      };
      const listMembers = createListMembers(mockClient as any);

      // Act
      const result = await listMembers({});

      // Assert
      expect(result).to.have.length(2);
      expect(result[0].name).to.equal("John Doe");
      expect(mockClient.member.findMany.calledOnce).to.be.true;
    });

    it("should return members with pagination", async () => {
      // Arrange
      const expectedMembers = [createMockMember("member-2", "Jane Smith")];
      const mockClient = {
        member: {
          findMany: sinon.stub().resolves(expectedMembers),
        },
      };
      const listMembers = createListMembers(mockClient as any);

      // Act
      const result = await listMembers({ limit: 10, offset: 1 });

      // Assert
      expect(result).to.have.length(1);
      expect(mockClient.member.findMany.calledOnce).to.be.true;
      expect(
        mockClient.member.findMany.calledWith({
          where: { isActive: true },
          take: 10,
          skip: 1,
        })
      ).to.be.true;
    });

    it("should return empty array when no members exist", async () => {
      // Arrange
      const mockClient = {
        member: {
          findMany: sinon.stub().resolves([]),
        },
      };
      const listMembers = createListMembers(mockClient as any);

      // Act
      const result = await listMembers({});

      // Assert
      expect(result).to.be.an("array").that.is.empty;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for negative offset", async () => {
      // Arrange
      const mockClient = {
        member: { findMany: sinon.stub() },
      };
      const listMembers = createListMembers(mockClient as any);

      // Act & Assert
      try {
        await listMembers({ offset: -1 });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.member.findMany.called).to.be.false;
      }
    });

    it("should throw ValidationError for limit exceeding max", async () => {
      // Arrange
      const mockClient = {
        member: { findMany: sinon.stub() },
      };
      const listMembers = createListMembers(mockClient as any);

      // Act & Assert
      try {
        await listMembers({ limit: 101 });
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
          findMany: sinon.stub().rejects(new Error("Database error")),
        },
      };
      const listMembers = createListMembers(mockClient as any);

      // Act & Assert
      try {
        await listMembers({});
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Database error");
      }
    });
  });
});
