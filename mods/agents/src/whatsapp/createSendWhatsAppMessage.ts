/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  sendWhatsAppMessageSchema,
  type SendWhatsAppMessageInput,
  type WhatsAppClient,
  type WhatsAppSendResponse
} from "@mikro/common";

/**
 * Creates a function to send WhatsApp messages.
 *
 * Uses dependency injection pattern for testability - the WhatsAppClient
 * can be mocked in tests.
 *
 * @param client - The WhatsApp client to use for sending messages
 * @returns A validated function that sends WhatsApp messages
 *
 * @example
 * ```typescript
 * // Production usage
 * const whatsAppClient = createWhatsAppClient();
 * const sendWhatsAppMessage = createSendWhatsAppMessage(whatsAppClient);
 *
 * await sendWhatsAppMessage({
 *   phone: "+1234567890",
 *   message: "Hello from Mikro!"
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Test usage with mock
 * const mockClient = {
 *   sendMessage: sinon.stub().resolves({ messages: [{ id: "123" }] }),
 *   downloadMedia: sinon.stub(),
 * };
 * const sendWhatsAppMessage = createSendWhatsAppMessage(mockClient);
 *
 * await sendWhatsAppMessage({ phone: "+1234567890", message: "Test" });
 * expect(mockClient.sendMessage.calledOnce).to.be.true;
 * ```
 */
export function createSendWhatsAppMessage(client: WhatsAppClient) {
  const fn = async (params: SendWhatsAppMessageInput): Promise<WhatsAppSendResponse> => {
    return client.sendMessage(params);
  };

  return withErrorHandlingAndValidation(fn, sendWhatsAppMessageSchema);
}
