/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createUpdateUser } from "../../src/api/users/createUpdateUser.js";
import { ValidationError } from "@mikro/common";

describe("createUpdateUser", () => {
  const validInput = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Updated Name",
    phone: "+1234567890",
    enabled: true,
  };

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should update a user with all fields", async () => {
      // Arrange
      const expectedUser = {
        id: validInput.id,
        name: validInput.name,
        phone: validInput.phone,
        enabled: validInput.enabled,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockClient = {
        user: {
          update: sinon.stub().resolves(expectedUser),
        },
      };
      const updateUser = createUpdateUser(mockClient as any);

      // Act
      const result = await updateUser(validInput);

      // Assert
      expect(result.id).to.equal(validInput.id);
      expect(result.name).to.equal(validInput.name);
      expect(mockClient.user.update.calledOnce).to.be.true;
      expect(
        mockClient.user.update.calledWith({
          where: { id: validInput.id },
          data: {
            name: validInput.name,
            phone: validInput.phone,
            enabled: validInput.enabled,
          },
        })
      ).to.be.true;
    });

    it("should update a user with partial fields", async () => {
      // Arrange
      const partialInput = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        enabled: false,
      };
      const expectedUser = {
        id: partialInput.id,
        name: "Existing Name",
        phone: "+1234567890",
        enabled: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const mockClient = {
        user: {
          update: sinon.stub().resolves(expectedUser),
        },
      };
      const updateUser = createUpdateUser(mockClient as any);

      // Act
      const result = await updateUser(partialInput);

      // Assert
      expect(result.enabled).to.be.false;
      expect(mockClient.user.update.calledOnce).to.be.true;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for invalid UUID", async () => {
      // Arrange
      const mockClient = {
        user: { update: sinon.stub() },
      };
      const updateUser = createUpdateUser(mockClient as any);

      // Act & Assert
      try {
        await updateUser({ id: "invalid-uuid", name: "Test" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.user.update.called).to.be.false;
      }
    });

    it("should throw ValidationError for empty name when provided", async () => {
      // Arrange
      const mockClient = {
        user: { update: sinon.stub() },
      };
      const updateUser = createUpdateUser(mockClient as any);

      // Act & Assert
      try {
        await updateUser({
          id: "550e8400-e29b-41d4-a716-446655440000",
          name: "",
        });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.user.update.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        user: {
          update: sinon.stub().rejects(new Error("User not found")),
        },
      };
      const updateUser = createUpdateUser(mockClient as any);

      // Act & Assert
      try {
        await updateUser(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("User not found");
      }
    });
  });
});
