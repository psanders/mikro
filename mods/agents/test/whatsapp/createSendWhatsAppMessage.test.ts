/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import sinon from "sinon";
import { createSendWhatsAppMessage } from "../../src/whatsapp/createSendWhatsAppMessage.js";
import { ValidationError } from "@mikro/common";

describe("createSendWhatsAppMessage", () => {
  const validTextInput = {
    phone: "+1234567890",
    message: "Hello from Mikro!"
  };

  const validImageInput = {
    phone: "+1234567890",
    imageUrl: "https://example.com/image.png",
    caption: "Check this out!"
  };

  afterEach(() => {
    sinon.restore();
  });

  describe("with valid input", () => {
    it("should send a text message", async () => {
      // Arrange
      const expectedResponse = {
        messages: [{ id: "msg-123" }]
      };
      const mockClient = {
        sendMessage: sinon.stub().resolves(expectedResponse),
        downloadMedia: sinon.stub()
      };
      const sendWhatsAppMessage = createSendWhatsAppMessage(mockClient as any);

      // Act
      const result = await sendWhatsAppMessage(validTextInput);

      // Assert
      expect(result).to.deep.equal(expectedResponse);
      expect(mockClient.sendMessage.calledOnce).to.be.true;
      expect(
        mockClient.sendMessage.calledWith({
          phone: validTextInput.phone,
          message: validTextInput.message
        })
      ).to.be.true;
    });

    it("should send an image message", async () => {
      // Arrange
      const expectedResponse = {
        messages: [{ id: "msg-456" }]
      };
      const mockClient = {
        sendMessage: sinon.stub().resolves(expectedResponse),
        downloadMedia: sinon.stub()
      };
      const sendWhatsAppMessage = createSendWhatsAppMessage(mockClient as any);

      // Act
      const result = await sendWhatsAppMessage(validImageInput);

      // Assert
      expect(result).to.deep.equal(expectedResponse);
      expect(mockClient.sendMessage.calledOnce).to.be.true;
      expect(
        mockClient.sendMessage.calledWith({
          phone: validImageInput.phone,
          imageUrl: validImageInput.imageUrl,
          caption: validImageInput.caption
        })
      ).to.be.true;
    });
  });

  describe("with invalid input", () => {
    it("should throw ValidationError for empty phone", async () => {
      // Arrange
      const mockClient = {
        sendMessage: sinon.stub(),
        downloadMedia: sinon.stub()
      };
      const sendWhatsAppMessage = createSendWhatsAppMessage(mockClient as any);

      // Act & Assert
      try {
        await sendWhatsAppMessage({ phone: "", message: "Test" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.sendMessage.called).to.be.false;
      }
    });

    it("should throw ValidationError when neither message nor imageUrl provided", async () => {
      // Arrange
      const mockClient = {
        sendMessage: sinon.stub(),
        downloadMedia: sinon.stub()
      };
      const sendWhatsAppMessage = createSendWhatsAppMessage(mockClient as any);

      // Act & Assert
      try {
        await sendWhatsAppMessage({ phone: "+1234567890" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.sendMessage.called).to.be.false;
      }
    });

    it("should throw ValidationError for invalid imageUrl", async () => {
      // Arrange
      const mockClient = {
        sendMessage: sinon.stub(),
        downloadMedia: sinon.stub()
      };
      const sendWhatsAppMessage = createSendWhatsAppMessage(mockClient as any);

      // Act & Assert
      try {
        await sendWhatsAppMessage({ phone: "+1234567890", imageUrl: "not-a-url" });
        expect.fail("Expected ValidationError to be thrown");
      } catch (error) {
        expect(error).to.be.instanceOf(ValidationError);
        expect(mockClient.sendMessage.called).to.be.false;
      }
    });
  });

  describe("when client throws an error", () => {
    it("should propagate the error", async () => {
      // Arrange
      const mockClient = {
        sendMessage: sinon.stub().rejects(new Error("WhatsApp API error")),
        downloadMedia: sinon.stub()
      };
      const sendWhatsAppMessage = createSendWhatsAppMessage(mockClient as any);

      // Act & Assert
      try {
        await sendWhatsAppMessage(validTextInput);
        expect.fail("Expected error to be thrown");
      } catch (error) {
        expect((error as Error).message).to.equal("WhatsApp API error");
      }
    });
  });
});
