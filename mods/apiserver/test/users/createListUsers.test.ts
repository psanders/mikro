/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createListUsers } from "../../src/api/users/createListUsers.js";
import { ValidationError } from "@mikro/common";

describe("createListUsers", () => {
  const createMockUser = (id: string, name: string) => ({
    id,
    name,
    phone: "+1234567890",
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should return all users without pagination", async () => {
      // Arrange
      const expectedUsers = [
        createMockUser("user-1", "John Doe"),
        createMockUser("user-2", "Jane Smith"),
      ];
      const mockClient = {
        user: {
          findMany: sinon.stub().resolves(expectedUsers),
        },
      };
      const listUsers = createListUsers(mockClient as any);

      // Act
      const result = await listUsers({});

      // Assert
      expect(result).to.have.length(2);
      expect(result[0].name).to.equal("John Doe");
      expect(mockClient.user.findMany.calledOnce).to.be.true;
    });

    it("should return users with pagination", async () => {
      // Arrange
      const expectedUsers = [createMockUser("user-2", "Jane Smith")];
      const mockClient = {
        user: {
          findMany: sinon.stub().resolves(expectedUsers),
        },
      };
      const listUsers = createListUsers(mockClient as any);

      // Act
      const result = await listUsers({ limit: 10, offset: 1 });

      // Assert
      expect(result).to.have.length(1);
      expect(mockClient.user.findMany.calledOnce).to.be.true;
      expect(
        mockClient.user.findMany.calledWith({
          where: { enabled: true },
          take: 10,
          skip: 1,
        })
      ).to.be.true;
    });

    it("should return empty array when no users exist", async () => {
      // Arrange
      const mockClient = {
        user: {
          findMany: sinon.stub().resolves([]),
        },
      };
      const listUsers = createListUsers(mockClient as any);

      // Act
      const result = await listUsers({});

      // Assert
      expect(result).to.be.an("array").that.is.empty;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for negative offset", async () => {
      // Arrange
      const mockClient = {
        user: { findMany: sinon.stub() },
      };
      const listUsers = createListUsers(mockClient as any);

      // Act & Assert
      try {
        await listUsers({ offset: -1 });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.user.findMany.called).to.be.false;
      }
    });

    it("should throw ValidationError for limit exceeding max", async () => {
      // Arrange
      const mockClient = {
        user: { findMany: sinon.stub() },
      };
      const listUsers = createListUsers(mockClient as any);

      // Act & Assert
      try {
        await listUsers({ limit: 101 });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.user.findMany.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        user: {
          findMany: sinon.stub().rejects(new Error("Database error")),
        },
      };
      const listUsers = createListUsers(mockClient as any);

      // Act & Assert
      try {
        await listUsers({});
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Database error");
      }
    });
  });
});
