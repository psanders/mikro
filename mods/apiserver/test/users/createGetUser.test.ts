/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createGetUser } from "../../src/api/users/createGetUser.js";
import { ValidationError } from "@mikro/common";

describe("createGetUser", () => {
  const validInput = {
    id: "550e8400-e29b-41d4-a716-446655440000",
  };

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should return a user when found", async () => {
      // Arrange
      const expectedUser = {
        id: validInput.id,
        name: "John Doe",
        phone: "+1234567890",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockClient = {
        user: {
          findUnique: sinon.stub().resolves(expectedUser),
        },
      };
      const getUser = createGetUser(mockClient as any);

      // Act
      const result = await getUser(validInput);

      // Assert
      expect(result).to.deep.equal(expectedUser);
      expect(mockClient.user.findUnique.calledOnce).to.be.true;
      expect(
        mockClient.user.findUnique.calledWith({
          where: { id: validInput.id },
        })
      ).to.be.true;
    });

    it("should return null when user not found", async () => {
      // Arrange
      const mockClient = {
        user: {
          findUnique: sinon.stub().resolves(null),
        },
      };
      const getUser = createGetUser(mockClient as any);

      // Act
      const result = await getUser(validInput);

      // Assert
      expect(result).to.be.null;
      expect(mockClient.user.findUnique.calledOnce).to.be.true;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for invalid UUID", async () => {
      // Arrange
      const mockClient = {
        user: { findUnique: sinon.stub() },
      };
      const getUser = createGetUser(mockClient as any);

      // Act & Assert
      try {
        await getUser({ id: "not-a-valid-uuid" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.user.findUnique.called).to.be.false;
      }
    });

    it("should throw ValidationError for missing id", async () => {
      // Arrange
      const mockClient = {
        user: { findUnique: sinon.stub() },
      };
      const getUser = createGetUser(mockClient as any);

      // Act & Assert
      try {
        await getUser({} as any);
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.user.findUnique.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        user: {
          findUnique: sinon.stub().rejects(new Error("Database error")),
        },
      };
      const getUser = createGetUser(mockClient as any);

      // Act & Assert
      try {
        await getUser(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Database error");
      }
    });
  });
});
