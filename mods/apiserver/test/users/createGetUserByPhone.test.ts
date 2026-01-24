/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createGetUserByPhone } from "../../src/api/users/createGetUserByPhone.js";
import { ValidationError } from "@mikro/common";

describe("createGetUserByPhone", () => {
  const validInput = {
    phone: "+1234567890"
  };

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should return a user with roles when found", async () => {
      // Arrange
      const expectedUser = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        name: "John Doe",
        phone: "+1234567890",
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        roles: [{ role: "ADMIN" as const }]
      };
      const mockClient = {
        user: {
          findFirst: sinon.stub().resolves(expectedUser)
        }
      };
      const getUserByPhone = createGetUserByPhone(mockClient as any);

      // Act
      const result = await getUserByPhone(validInput);

      // Assert
      expect(result).to.deep.equal(expectedUser);
      expect(result?.roles).to.have.length(1);
      expect(result?.roles[0].role).to.equal("ADMIN");
      expect(mockClient.user.findFirst.calledOnce).to.be.true;
      expect(
        mockClient.user.findFirst.calledWith({
          where: { phone: validInput.phone },
          include: {
            roles: {
              select: { role: true }
            }
          }
        })
      ).to.be.true;
    });

    it("should return null when user not found", async () => {
      // Arrange
      const mockClient = {
        user: {
          findFirst: sinon.stub().resolves(null)
        }
      };
      const getUserByPhone = createGetUserByPhone(mockClient as any);

      // Act
      const result = await getUserByPhone(validInput);

      // Assert
      expect(result).to.be.null;
      expect(mockClient.user.findFirst.calledOnce).to.be.true;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for empty phone", async () => {
      // Arrange
      const mockClient = {
        user: { findFirst: sinon.stub() }
      };
      const getUserByPhone = createGetUserByPhone(mockClient as any);

      // Act & Assert
      try {
        await getUserByPhone({ phone: "" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.user.findFirst.called).to.be.false;
      }
    });

    it("should throw ValidationError for missing phone", async () => {
      // Arrange
      const mockClient = {
        user: { findFirst: sinon.stub() }
      };
      const getUserByPhone = createGetUserByPhone(mockClient as any);

      // Act & Assert
      try {
        await getUserByPhone({} as any);
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.user.findFirst.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        user: {
          findFirst: sinon.stub().rejects(new Error("Database error"))
        }
      };
      const getUserByPhone = createGetUserByPhone(mockClient as any);

      // Act & Assert
      try {
        await getUserByPhone(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Database error");
      }
    });
  });
});
