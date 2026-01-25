/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
export {
  handleWhatsAppMessage,
  setMessageProcessor,
  getMessageProcessorState,
  markInitializationComplete,
  type HandleWhatsAppMessageResult,
  type MessageProcessorDependencies
} from "./handleWhatsAppMessage.js";
export { createSendWhatsAppMessage } from "./createSendWhatsAppMessage.js";
export { createWhatsAppClient } from "./client/index.js";
