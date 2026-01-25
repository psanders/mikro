/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * @mikro/agents - AI Agents and messaging integrations
 */

// WhatsApp integration
export {
  handleWhatsAppMessage,
  setMessageProcessor,
  getMessageProcessorState,
  markInitializationComplete,
  createSendWhatsAppMessage,
  createWhatsAppClient,
  type HandleWhatsAppMessageResult,
  type MessageProcessorDependencies
} from "./whatsapp/index.js";

// LLM integration
export {
  createInvokeLLM,
  type ModelSettings,
  type Agent,
  type Message,
  type MessageContentItem,
  type ToolCall,
  type ToolFunction,
  type ToolResult,
  type ToolExecutor
} from "./llm/index.js";

// Tools
export {
  allTools,
  getToolByName,
  createMemberTool,
  createPaymentTool,
  sendReceiptViaWhatsAppTool,
  listPaymentsByLoanIdTool,
  listLoansByCollectorTool,
  getMemberTool,
  createLoanTool,
  createToolExecutor
} from "./tools/index.js";

// Router
export {
  createMessageRouter,
  type RouteResult,
  type RouterDependencies,
  type UserLookupResult,
  type MemberLookupResult
} from "./router/index.js";

// Conversations
export {
  getGuestConversation,
  addGuestMessage,
  clearGuestConversation,
  hasGuestConversation,
  getActiveGuestPhones,
  getActiveGuestCount,
  migrateGuestToDatabase
} from "./conversations/index.js";

// Config utilities
export {
  getWebhookVerifyToken,
  getWhatsAppPhoneNumberId,
  getWhatsAppAccessToken,
  getImagesPath,
  getPublicUrl,
  getPublicImageUrl,
  getOpenAIApiKey
} from "./config.js";
