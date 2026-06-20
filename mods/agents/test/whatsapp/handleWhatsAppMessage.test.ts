/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import {
  handleWhatsAppMessage,
  setMessageProcessor,
  markInitializationComplete,
  resetProcessedMessageIdsForTesting
} from "../../src/whatsapp/handleWhatsAppMessage.js";
import { clearSessionsForTesting } from "../../src/sessions/sessionStore.js";
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

  const adminRoute = {
    type: "user" as const,
    userId: "user-1",
    name: "Admin",
    role: "ADMIN" as const,
    phone: "+1234567890"
  };

  const mockMessageProcessor = {
    routeMessage: sinon.stub().resolves(adminRoute),
    invokeLLM: sinon.stub().resolves("AI response"),
    sendWhatsAppMessage: sinon.stub().resolves({ messages: [{ id: "response-123" }] }),
    downloadMedia: sinon.stub().resolves("data:image/png;base64,mock"),
    getChatHistoryForUser: sinon.stub().resolves([]),
    addMessageForUser: sinon.stub().resolves(),
    getAgentForProfile: sinon.stub().returns({
      name: "maria",
      profile: "ADMIN",
      enabled: true,
      systemPrompt: "You are Maria",
      allowedTools: []
    }),
    submitApplicationFromFlow: sinon.stub().resolves()
  };

  beforeEach(() => {
    // Recreate stubs each run so afterEach's sinon.restore() doesn't leave
    // mockMessageProcessor with restored (non-stub) methods for the next test.
    mockMessageProcessor.routeMessage = sinon.stub().resolves(adminRoute);
    mockMessageProcessor.invokeLLM = sinon.stub().resolves("AI response");
    mockMessageProcessor.sendWhatsAppMessage = sinon
      .stub()
      .resolves({ messages: [{ id: "response-123" }] });
    mockMessageProcessor.downloadMedia = sinon.stub().resolves("data:image/png;base64,mock");
    mockMessageProcessor.getChatHistoryForUser = sinon.stub().resolves([]);
    mockMessageProcessor.addMessageForUser = sinon.stub().resolves();
    mockMessageProcessor.getAgentForProfile = sinon.stub().returns({
      name: "maria",
      profile: "ADMIN",
      enabled: true,
      systemPrompt: "You are Maria",
      allowedTools: []
    });
    mockMessageProcessor.submitApplicationFromFlow = sinon.stub().resolves();

    resetProcessedMessageIdsForTesting();
    clearSessionsForTesting();
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
    const voiceNoteWebhook = (audioId = "voice-msg-123") => ({
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
                    timestamp: recentTs(),
                    audio: { id: audioId }
                  }
                ]
              }
            }
          ]
        }
      ]
    });

    it("should respond with not available when transcribeVoiceNote is undefined", async () => {
      const result = await handleWhatsAppMessage(voiceNoteWebhook());

      expect(result.messagesProcessed).to.equal(1);
      expect(mockMessageProcessor.sendWhatsAppMessage.calledOnce).to.be.true;
      expect(
        mockMessageProcessor.sendWhatsAppMessage.calledWithMatch({
          phone: "+1234567890",
          message: sinon.match(/notas de voz/)
        })
      ).to.be.true;
      expect(mockMessageProcessor.invokeLLM.called).to.be.false;
    });

    it("should transcribe and process voice note when transcribeVoiceNote is provided", async () => {
      const dataUrl = "data:audio/ogg;base64,T2dnUw";
      mockMessageProcessor.downloadMedia.withArgs("aid").resolves(dataUrl);
      const transcribeStub = sinon.stub().resolves("transcribed text");
      setMessageProcessor({
        ...mockMessageProcessor,
        transcribeVoiceNote: transcribeStub
      });

      const result = await handleWhatsAppMessage(voiceNoteWebhook("aid"));

      expect(result.messagesProcessed).to.equal(1);
      expect(mockMessageProcessor.downloadMedia.calledOnceWith("aid")).to.be.true;
      expect(transcribeStub.calledOnce, "transcribeVoiceNote should be called once").to.be.true;
      expect(
        transcribeStub.firstCall.args[0],
        "transcribeVoiceNote should be called with dataUrl"
      ).to.equal(dataUrl);
      expect(mockMessageProcessor.invokeLLM.calledOnce).to.be.true;
      const invokeArgs = mockMessageProcessor.invokeLLM.firstCall.args;
      expect(invokeArgs[2]).to.equal("[Voice]: transcribed text");
      expect(mockMessageProcessor.sendWhatsAppMessage.calledOnce).to.be.true;
      expect(mockMessageProcessor.sendWhatsAppMessage.firstCall.args[0].message).to.equal(
        "AI response"
      );
    });

    it("should send error message when voice note transcription fails", async () => {
      mockMessageProcessor.downloadMedia.withArgs("aid").resolves("data:audio/ogg;base64,x");
      const transcribeStub = sinon.stub().rejects(new Error("Deepgram error"));
      setMessageProcessor({
        ...mockMessageProcessor,
        transcribeVoiceNote: transcribeStub
      });

      const result = await handleWhatsAppMessage(voiceNoteWebhook("aid"));

      expect(result.messagesProcessed).to.equal(1);
      expect(mockMessageProcessor.invokeLLM.called).to.be.false;
      expect(mockMessageProcessor.sendWhatsAppMessage.calledOnce).to.be.true;
      const sendArgs = mockMessageProcessor.sendWhatsAppMessage.firstCall.args[0];
      expect(sendArgs.phone).to.equal("+1234567890");
      expect(sendArgs.message).to.match(/No pude entender el audio/);
    });
  });

  describe("session handling", () => {
    const recentTimestamp = () => String(Math.floor(Date.now() / 1000) - 10);

    it("ignores unknown (guest) phones — no AI reply (Joan removed)", async () => {
      const guestPhone = "+15551112222";
      mockMessageProcessor.routeMessage.withArgs(guestPhone).resolves({
        type: "ignored" as const,
        reason: "unknown phone — onboarding over WhatsApp is disabled",
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
                      id: "msg-guest",
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

      expect(mockMessageProcessor.invokeLLM.called, "no LLM for unknown phones").to.be.false;
      expect(mockMessageProcessor.sendWhatsAppMessage.called, "no reply for unknown phones").to.be
        .false;
    });

    it("should pass isNewSession true for first user message", async () => {
      const userPhone = "+15556667777";
      const userId = "user-session-first";
      mockMessageProcessor.routeMessage.withArgs(userPhone).resolves({
        type: "user" as const,
        userId,
        role: "ADMIN" as const,
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
        role: "ADMIN" as const,
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

  describe("prospect intake flow", () => {
    const recentTimestamp = () => String(Math.floor(Date.now() / 1000) - 10);
    const prospect = "+18095559999";

    const guestWebhook = (id: string, body = "Hola") => ({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { from: prospect, type: "text", id, timestamp: recentTimestamp(), text: { body } }
                ]
              }
            }
          ]
        }
      ]
    });

    const nfmWebhook = (id: string, answers: Record<string, unknown>) => ({
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: prospect,
                    type: "interactive",
                    id,
                    timestamp: recentTimestamp(),
                    interactive: {
                      type: "nfm_reply",
                      nfm_reply: {
                        name: "flow",
                        body: "Sent",
                        response_json: JSON.stringify(answers)
                      }
                    }
                  }
                ]
              }
            }
          ]
        }
      ]
    });

    it("does not respond to an unknown number (no greeting, no notification)", async () => {
      mockMessageProcessor.routeMessage.withArgs(prospect).resolves({
        type: "ignored" as const,
        reason: "unknown phone — no automated WhatsApp response",
        phone: prospect
      });

      await handleWhatsAppMessage(guestWebhook("msg-g1"));

      expect(mockMessageProcessor.sendWhatsAppMessage.called, "nothing sent back").to.be.false;
      expect(mockMessageProcessor.invokeLLM.called, "no LLM").to.be.false;
    });

    it("submits a completed Flow and confirms to the prospect", async () => {
      await handleWhatsAppMessage(
        nfmWebhook("msg-nfm1", {
          firstName: "Juan",
          lastName: "Pérez",
          businessType: "COLMADO",
          dateOfBirth: "632361600000",
          requestedAmount: "30000"
        })
      );

      expect(mockMessageProcessor.submitApplicationFromFlow.calledOnce).to.be.true;
      const payload = mockMessageProcessor.submitApplicationFromFlow.firstCall.args[0];
      expect(payload.sessionId).to.equal("wa-msg-nfm1");
      expect(payload.phone).to.equal(prospect);
      expect(payload.partial).to.equal(false);
      expect(payload.firstName).to.equal("Juan");
      expect(payload.dateOfBirth).to.equal("1990-01-15");
      // confirmation message sent (text, not a flow)
      expect(mockMessageProcessor.sendWhatsAppMessage.calledOnce).to.be.true;
      expect(mockMessageProcessor.sendWhatsAppMessage.firstCall.args[0].message).to.be.a("string");
      // no LLM/agent involvement for a flow submission
      expect(mockMessageProcessor.invokeLLM.called).to.be.false;
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
