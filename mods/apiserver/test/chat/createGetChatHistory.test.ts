/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createGetChatHistory } from "../../src/api/chat/createGetChatHistory.js";
import { ValidationError } from "@mikro/common";

describe("createGetChatHistory", () => {
  const validMemberId = "550e8400-e29b-41d4-a716-446655440000";
  const validUserId = "660e8400-e29b-41d4-a716-446655440001";

  const createMockMessage = (id: string, content: string, role: "AI" | "HUMAN") => ({
    id,
    role,
    content,
    tools: null,
    memberId: validMemberId,
    userId: null,
    createdAt: new Date(),
    attachments: [],
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should return chat history for a member", async () => {
      // Arrange
      const expectedMessages = [
        createMockMessage("msg-1", "Hello", "HUMAN"),
        createMockMessage("msg-2", "Hi there!", "AI"),
      ];
      const mockClient = {
        message: {
          findMany: sinon.stub().resolves(expectedMessages),
        },
      };
      const getChatHistory = createGetChatHistory(mockClient as any);

      // Act
      const result = await getChatHistory({ memberId: validMemberId });

      // Assert
      expect(result).to.have.length(2);
      expect(result[0].content).to.equal("Hello");
      expect(mockClient.message.findMany.calledOnce).to.be.true;
    });

    it("should return chat history for a user", async () => {
      // Arrange
      const expectedMessages = [
        { ...createMockMessage("msg-1", "User message", "HUMAN"), memberId: null, userId: validUserId },
      ];
      const mockClient = {
        message: {
          findMany: sinon.stub().resolves(expectedMessages),
        },
      };
      const getChatHistory = createGetChatHistory(mockClient as any);

      // Act
      const result = await getChatHistory({ userId: validUserId });

      // Assert
      expect(result).to.have.length(1);
      expect(mockClient.message.findMany.calledOnce).to.be.true;
      const callArgs = mockClient.message.findMany.firstCall.args[0];
      expect(callArgs.where.userId).to.equal(validUserId);
    });

    it("should return chat history with pagination", async () => {
      // Arrange
      const expectedMessages = [createMockMessage("msg-1", "Hello", "HUMAN")];
      const mockClient = {
        message: {
          findMany: sinon.stub().resolves(expectedMessages),
        },
      };
      const getChatHistory = createGetChatHistory(mockClient as any);

      // Act
      const result = await getChatHistory({
        memberId: validMemberId,
        limit: 10,
        offset: 5,
      });

      // Assert
      expect(result).to.have.length(1);
      const callArgs = mockClient.message.findMany.firstCall.args[0];
      expect(callArgs.take).to.equal(10);
      expect(callArgs.skip).to.equal(5);
    });

    it("should return empty array when no messages exist", async () => {
      // Arrange
      const mockClient = {
        message: {
          findMany: sinon.stub().resolves([]),
        },
      };
      const getChatHistory = createGetChatHistory(mockClient as any);

      // Act
      const result = await getChatHistory({ memberId: validMemberId });

      // Assert
      expect(result).to.be.an("array").that.is.empty;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError when neither memberId nor userId provided", async () => {
      // Arrange
      const mockClient = {
        message: { findMany: sinon.stub() },
      };
      const getChatHistory = createGetChatHistory(mockClient as any);

      // Act & Assert
      try {
        await getChatHistory({});
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.message.findMany.called).to.be.false;
      }
    });

    it("should throw ValidationError when both memberId and userId provided", async () => {
      // Arrange
      const mockClient = {
        message: { findMany: sinon.stub() },
      };
      const getChatHistory = createGetChatHistory(mockClient as any);

      // Act & Assert
      try {
        await getChatHistory({ memberId: validMemberId, userId: validUserId });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.message.findMany.called).to.be.false;
      }
    });

    it("should throw ValidationError for invalid memberId UUID", async () => {
      // Arrange
      const mockClient = {
        message: { findMany: sinon.stub() },
      };
      const getChatHistory = createGetChatHistory(mockClient as any);

      // Act & Assert
      try {
        await getChatHistory({ memberId: "invalid-uuid" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.message.findMany.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        message: {
          findMany: sinon.stub().rejects(new Error("Database error")),
        },
      };
      const getChatHistory = createGetChatHistory(mockClient as any);

      // Act & Assert
      try {
        await getChatHistory({ memberId: validMemberId });
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Database error");
      }
    });
  });
});
