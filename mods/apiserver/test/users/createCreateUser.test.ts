/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createCreateUser } from "../../src/api/users/createCreateUser.js";
import { ValidationError } from "@mikro/common";

describe("createCreateUser", () => {
  const validInput = {
    name: "John Doe",
    phone: "+1234567890"
  };

  const validInputWithRole = {
    name: "Jane Admin",
    phone: "+0987654321",
    role: "ADMIN" as const
  };

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should create a user without role", async () => {
      // Arrange
      const expectedUser = {
        id: "user-123",
        name: validInput.name,
        phone: validInput.phone,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const mockClient = {
        user: {
          create: sinon.stub().resolves(expectedUser)
        },
        userRole: {
          create: sinon.stub().resolves({})
        }
      };
      const createUser = createCreateUser(mockClient as any);

      // Act
      const result = await createUser(validInput);

      // Assert
      expect(result.id).to.equal("user-123");
      expect(result.name).to.equal(validInput.name);
      expect(mockClient.user.create.calledOnce).to.be.true;
      expect(mockClient.userRole.create.called).to.be.false;
    });

    it("should create a user with role", async () => {
      // Arrange
      const expectedUser = {
        id: "user-456",
        name: validInputWithRole.name,
        phone: validInputWithRole.phone,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      const mockClient = {
        user: {
          create: sinon.stub().resolves(expectedUser)
        },
        userRole: {
          create: sinon.stub().resolves({
            id: "role-123",
            userId: "user-456",
            role: "ADMIN"
          })
        }
      };
      const createUser = createCreateUser(mockClient as any);

      // Act
      const result = await createUser(validInputWithRole);

      // Assert
      expect(result.id).to.equal("user-456");
      expect(mockClient.user.create.calledOnce).to.be.true;
      expect(mockClient.userRole.create.calledOnce).to.be.true;
      expect(
        mockClient.userRole.create.calledWith({
          data: { userId: "user-456", role: "ADMIN" }
        })
      ).to.be.true;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for empty name", async () => {
      // Arrange
      const mockClient = {
        user: { create: sinon.stub() },
        userRole: { create: sinon.stub() }
      };
      const createUser = createCreateUser(mockClient as any);

      // Act & Assert
      try {
        await createUser({ name: "" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.user.create.called).to.be.false;
      }
    });

    it("should throw ValidationError for invalid role", async () => {
      // Arrange
      const mockClient = {
        user: { create: sinon.stub() },
        userRole: { create: sinon.stub() }
      };
      const createUser = createCreateUser(mockClient as any);

      // Act & Assert
      try {
        await createUser({ name: "Test", role: "INVALID_ROLE" as any });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.user.create.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        user: {
          create: sinon.stub().rejects(new Error("Connection failed"))
        },
        userRole: { create: sinon.stub() }
      };
      const createUser = createCreateUser(mockClient as any);

      // Act & Assert
      try {
        await createUser(validInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Connection failed");
      }
    });
  });
});
