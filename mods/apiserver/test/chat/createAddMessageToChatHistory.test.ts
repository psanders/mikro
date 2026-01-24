/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createAddMessageToChatHistory } from "../../src/api/chat/createAddMessageToChatHistory.js";
import { ValidationError } from "@mikro/common";

describe("createAddMessageToChatHistory", () => {
  const validMemberId = "550e8400-e29b-41d4-a716-446655440000";
  const validUserId = "660e8400-e29b-41d4-a716-446655440001";

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should add a message for a member", async () => {
      // Arrange
      const input = {
        memberId: validMemberId,
        role: "HUMAN" as const,
        content: "Hello, I need help"
      };
      const expectedMessage = {
        id: "msg-123",
        role: "HUMAN",
        content: input.content,
        tools: null,
        memberId: validMemberId,
        userId: null,
        createdAt: new Date()
      };
      const mockClient = {
        message: {
          create: sinon.stub().resolves(expectedMessage)
        },
        attachment: {
          createMany: sinon.stub().resolves({ count: 0 })
        }
      };
      const addMessage = createAddMessageToChatHistory(mockClient as any);

      // Act
      const result = await addMessage(input);

      // Assert
      expect(result.id).to.equal("msg-123");
      expect(result.content).to.equal(input.content);
      expect(mockClient.message.create.calledOnce).to.be.true;
      expect(mockClient.attachment.createMany.called).to.be.false;
    });

    it("should add a message for a user", async () => {
      // Arrange
      const input = {
        userId: validUserId,
        role: "AI" as const,
        content: "How can I assist you?",
        tools: ["search"]
      };
      const expectedMessage = {
        id: "msg-456",
        role: "AI",
        content: input.content,
        tools: JSON.stringify(input.tools),
        memberId: null,
        userId: validUserId,
        createdAt: new Date()
      };
      const mockClient = {
        message: {
          create: sinon.stub().resolves(expectedMessage)
        },
        attachment: {
          createMany: sinon.stub().resolves({ count: 0 })
        }
      };
      const addMessage = createAddMessageToChatHistory(mockClient as any);

      // Act
      const result = await addMessage(input);

      // Assert
      expect(result.id).to.equal("msg-456");
      expect(mockClient.message.create.calledOnce).to.be.true;
    });

    it("should add a message with attachments", async () => {
      // Arrange
      const input = {
        memberId: validMemberId,
        role: "HUMAN" as const,
        content: "Here is a document",
        attachments: [
          {
            type: "DOCUMENT" as const,
            url: "https://example.com/doc.pdf",
            name: "document.pdf",
            mimeType: "application/pdf",
            size: 1024
          }
        ]
      };
      const expectedMessage = {
        id: "msg-789",
        role: "HUMAN",
        content: input.content,
        tools: null,
        memberId: validMemberId,
        userId: null,
        createdAt: new Date()
      };
      const mockClient = {
        message: {
          create: sinon.stub().resolves(expectedMessage)
        },
        attachment: {
          createMany: sinon.stub().resolves({ count: 1 })
        }
      };
      const addMessage = createAddMessageToChatHistory(mockClient as any);

      // Act
      const result = await addMessage(input);

      // Assert
      expect(result.id).to.equal("msg-789");
      expect(mockClient.message.create.calledOnce).to.be.true;
      expect(mockClient.attachment.createMany.calledOnce).to.be.true;
      const attachmentCall = mockClient.attachment.createMany.firstCall.args[0];
      expect(attachmentCall.data).to.have.length(1);
      expect(attachmentCall.data[0].messageId).to.equal("msg-789");
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError when neither memberId nor userId provided", async () => {
      // Arrange
      const mockClient = {
        message: { create: sinon.stub() },
        attachment: { createMany: sinon.stub() }
      };
      const addMessage = createAddMessageToChatHistory(mockClient as any);

      // Act & Assert
      try {
        await addMessage({ role: "HUMAN", content: "Hello" } as any);
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.message.create.called).to.be.false;
      }
    });

    it("should throw ValidationError when both memberId and userId provided", async () => {
      // Arrange
      const mockClient = {
        message: { create: sinon.stub() },
        attachment: { createMany: sinon.stub() }
      };
      const addMessage = createAddMessageToChatHistory(mockClient as any);

      // Act & Assert
      try {
        await addMessage({
          memberId: validMemberId,
          userId: validUserId,
          role: "HUMAN",
          content: "Hello"
        });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.message.create.called).to.be.false;
      }
    });

    it("should throw ValidationError for empty content", async () => {
      // Arrange
      const mockClient = {
        message: { create: sinon.stub() },
        attachment: { createMany: sinon.stub() }
      };
      const addMessage = createAddMessageToChatHistory(mockClient as any);

      // Act & Assert
      try {
        await addMessage({
          memberId: validMemberId,
          role: "HUMAN",
          content: ""
        });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.message.create.called).to.be.false;
      }
    });

    it("should throw ValidationError for invalid role", async () => {
      // Arrange
      const mockClient = {
        message: { create: sinon.stub() },
        attachment: { createMany: sinon.stub() }
      };
      const addMessage = createAddMessageToChatHistory(mockClient as any);

      // Act & Assert
      try {
        await addMessage({
          memberId: validMemberId,
          role: "INVALID" as any,
          content: "Hello"
        });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.message.create.called).to.be.false;
      }
    });

    it("should throw ValidationError for invalid attachment URL", async () => {
      // Arrange
      const mockClient = {
        message: { create: sinon.stub() },
        attachment: { createMany: sinon.stub() }
      };
      const addMessage = createAddMessageToChatHistory(mockClient as any);

      // Act & Assert
      try {
        await addMessage({
          memberId: validMemberId,
          role: "HUMAN",
          content: "Hello",
          attachments: [
            {
              type: "IMAGE" as const,
              url: "not-a-valid-url"
            }
          ]
        });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.message.create.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        message: {
          create: sinon.stub().rejects(new Error("Database error"))
        },
        attachment: { createMany: sinon.stub() }
      };
      const addMessage = createAddMessageToChatHistory(mockClient as any);

      // Act & Assert
      try {
        await addMessage({
          memberId: validMemberId,
          role: "HUMAN",
          content: "Hello"
        });
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("Database error");
      }
    });
  });
});
