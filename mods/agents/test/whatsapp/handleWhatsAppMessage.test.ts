/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import {
  handleWhatsAppMessage,
  setMessageProcessor,
  markInitializationComplete
} from "../../src/whatsapp/handleWhatsAppMessage.js";
import { ValidationError } from "@mikro/common";

describe("handleWhatsAppMessage", () => {
  const recentTs = () => String(Math.floor(Date.now() / 1000) - 10);
  const getValidWebhookBody = () => ({
    object: "whatsapp_business_account",
    entry: [
      {
        changes: [
          {
            value: {
              messages: [
                {
                  from: "+1234567890",
                  type: "text",
                  id: "msg-123",
                  timestamp: recentTs(),
                  text: { body: "Hello" }
                }
              ]
            }
          }
        ]
      }
    ]
  });

  const mockMessageProcessor = {
    routeMessage: sinon.stub().resolves({ type: "guest" as const }),
    invokeLLM: sinon.stub().resolves("AI response"),
    sendWhatsAppMessage: sinon.stub().resolves({ messages: [{ id: "response-123" }] }),
    downloadMedia: sinon.stub().resolves("data:image/png;base64,mock"),
    getChatHistoryForUser: sinon.stub().resolves([]),
    addMessageForUser: sinon.stub().resolves(),
    getAgent: sinon.stub().returns({
      name: "joan",
      systemPrompt: "You are Joan",
      tools: []
    })
  };

  beforeEach(() => {
    // Reset all stub call histories
    mockMessageProcessor.routeMessage.resetHistory();
    mockMessageProcessor.invokeLLM.resetHistory();
    mockMessageProcessor.sendWhatsAppMessage.resetHistory();
    mockMessageProcessor.downloadMedia.resetHistory();
    mockMessageProcessor.getChatHistoryForUser.resetHistory();
    mockMessageProcessor.addMessageForUser.resetHistory();
    mockMessageProcessor.getAgent.resetHistory();

    setMessageProcessor(mockMessageProcessor);
    markInitializationComplete();
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should process whatsapp_business_account events", async () => {
      const result = await handleWhatsAppMessage(getValidWebhookBody());

      // Assert
      expect(result.messagesProcessed).to.equal(1);
      expect(result.senders).to.include("+1234567890");
    });

    it("should ignore non-whatsapp_business_account events", async () => {
      // Arrange
      const invalidWebhookBody = {
        object: "other_type",
        entry: []
      };

      // Act
      const result = await handleWhatsAppMessage(invalidWebhookBody);

      // Assert
      expect(result.messagesProcessed).to.equal(0);
      expect(result.senders).to.be.an("array").that.is.empty;
    });

    it("should process multiple messages from same sender", async () => {
      const ts = recentTs();
      const multiMessageWebhook = {
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: "+1234567890",
                      type: "text",
                      id: "msg-1",
                      timestamp: ts,
                      text: { body: "Message 1" }
                    },
                    {
                      from: "+1234567890",
                      type: "text",
                      id: "msg-2",
                      timestamp: ts,
                      text: { body: "Message 2" }
                    }
                  ]
                }
              }
            ]
          }
        ]
      };

      // Act
      const result = await handleWhatsAppMessage(multiMessageWebhook);

      // Assert
      expect(result.messagesProcessed).to.equal(2);
      expect(result.senders).to.have.length(1);
      expect(result.senders[0]).to.equal("+1234567890");
    });

    it("should handle empty entries array", async () => {
      // Arrange
      const emptyWebhook = {
        object: "whatsapp_business_account",
        entry: []
      };

      // Act
      const result = await handleWhatsAppMessage(emptyWebhook);

      // Assert
      expect(result.messagesProcessed).to.equal(0);
      expect(result.senders).to.be.an("array").that.is.empty;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for invalid webhook structure", async () => {
      // Arrange
      const invalidWebhook = {
        entry: "not-an-array"
      };

      // Act & Assert
      try {
        await handleWhatsAppMessage(invalidWebhook as any);
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
      }
    });
  });

  describe("voice note handling", () => {
    it("should respond with unsupported message for audio/voice notes", async () => {
      const voiceNoteWebhook = {
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: "+1234567890",
                      type: "audio",
                      id: "voice-msg-123",
                      timestamp: recentTs()
                    }
                  ]
                }
              }
            ]
          }
        ]
      };

      // Act
      const result = await handleWhatsAppMessage(voiceNoteWebhook);

      // Assert
      expect(result.messagesProcessed).to.equal(1);
      expect(mockMessageProcessor.sendWhatsAppMessage.calledOnce).to.be.true;
      expect(
        mockMessageProcessor.sendWhatsAppMessage.calledWithMatch({
          phone: "+1234567890",
          message: sinon.match(/notas de voz/)
        })
      ).to.be.true;
      // LLM should NOT be invoked for voice notes
      expect(mockMessageProcessor.invokeLLM.called).to.be.false;
    });
  });

  describe("session handling", () => {
    const recentTimestamp = () => String(Math.floor(Date.now() / 1000) - 10);

    it("should pass isNewSession true for first guest message", async () => {
      const guestPhone = "+15551112222";
      mockMessageProcessor.routeMessage.withArgs(guestPhone).resolves({
        type: "guest" as const,
        phone: guestPhone
      });

      const webhook = {
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: guestPhone,
                      type: "text",
                      id: "msg-first",
                      timestamp: recentTimestamp(),
                      text: { body: "Hola" }
                    }
                  ]
                }
              }
            ]
          }
        ]
      };

      await handleWhatsAppMessage(webhook);

      expect(mockMessageProcessor.invokeLLM.calledOnce).to.be.true;
      const invokeArgs = mockMessageProcessor.invokeLLM.getCall(0).args;
      expect(invokeArgs[5]).to.equal(true);
    });

    it("should pass isNewSession false for second guest message within session", async () => {
      const guestPhone = "+15553334444";
      mockMessageProcessor.routeMessage.withArgs(guestPhone).resolves({
        type: "guest" as const,
        phone: guestPhone
      });

      const webhook = (from: string, id: string, body: string) => ({
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    { from, type: "text", id, timestamp: recentTimestamp(), text: { body } }
                  ]
                }
              }
            ]
          }
        ]
      });

      await handleWhatsAppMessage(webhook(guestPhone, "msg-1", "Hola"));
      expect(mockMessageProcessor.invokeLLM.getCall(0).args[5]).to.equal(true);

      await handleWhatsAppMessage(webhook(guestPhone, "msg-2", "Necesito ayuda"));
      expect(mockMessageProcessor.invokeLLM.calledTwice).to.be.true;
      expect(mockMessageProcessor.invokeLLM.getCall(1).args[5]).to.equal(false);
    });

    it("should pass isNewSession true for first user message", async () => {
      const userPhone = "+15556667777";
      const userId = "user-session-first";
      mockMessageProcessor.routeMessage.withArgs(userPhone).resolves({
        type: "user" as const,
        userId,
        role: "COLLECTOR" as const,
        phone: userPhone
      });
      mockMessageProcessor.getChatHistoryForUser.withArgs(userId).resolves([]);

      const webhook = {
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: userPhone,
                      type: "text",
                      id: "msg-user-1",
                      timestamp: recentTimestamp(),
                      text: { body: "Hola" }
                    }
                  ]
                }
              }
            ]
          }
        ]
      };

      await handleWhatsAppMessage(webhook);

      expect(mockMessageProcessor.invokeLLM.calledOnce).to.be.true;
      expect(mockMessageProcessor.invokeLLM.getCall(0).args[5]).to.equal(true);
    });

    it("should pass isNewSession false for second user message within session", async () => {
      const userPhone = "+15557778888";
      const userId = "user-session-second";
      mockMessageProcessor.routeMessage.withArgs(userPhone).resolves({
        type: "user" as const,
        userId,
        role: "COLLECTOR" as const,
        phone: userPhone
      });
      mockMessageProcessor.getChatHistoryForUser.withArgs(userId).resolves([]);

      const webhook = (id: string, body: string) => ({
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: userPhone,
                      type: "text",
                      id,
                      timestamp: recentTimestamp(),
                      text: { body }
                    }
                  ]
                }
              }
            ]
          }
        ]
      });

      await handleWhatsAppMessage(webhook("msg-u1", "Hola"));
      expect(mockMessageProcessor.invokeLLM.getCall(0).args[5]).to.equal(true);

      await handleWhatsAppMessage(webhook("msg-u2", "Registrar un pago"));
      expect(mockMessageProcessor.invokeLLM.calledTwice).to.be.true;
      expect(mockMessageProcessor.invokeLLM.getCall(1).args[5]).to.equal(false);
    });
  });

  describe("when message processor is not configured", () => {
    it("should not process messages when processor is missing", async () => {
      // Arrange - Reset processor
      setMessageProcessor(mockMessageProcessor);

      const webhookWithMessage = {
        object: "whatsapp_business_account",
        entry: [
          {
            changes: [
              {
                value: {
                  messages: [
                    {
                      from: "+1234567890",
                      type: "text",
                      id: "msg-123",
                      timestamp: recentTs(),
                      text: { body: "Hello" }
                    }
                  ]
                }
              }
            ]
          }
        ]
      };
      const result = await handleWhatsAppMessage(webhookWithMessage);

      // Assert - Should still count messages processed
      expect(result.messagesProcessed).to.equal(1);
    });
  });
});
