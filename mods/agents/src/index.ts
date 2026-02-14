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
  invokeTextPrompt,
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

// Sessions
export { isNewSession, touchSession } from "./sessions/index.js";

// Config utilities
export {
  getWebhookVerifyToken,
  getWhatsAppPhoneNumberId,
  getWhatsAppAccessToken,
  getPublicPath,
  getPublicUrl,
  getPublicImageUrl,
  getDisabledAgents,
  getLLMConfig,
  validateAllLLMConfigs,
  clearLLMConfigCache,
  type LLMConfig,
  type LLMPurpose
} from "./config.js";

// LLM providers
export {
  createChatModel,
  parseLLMConfig,
  validateModelForVendor,
  getModelsForVendor,
  getVisionModelsForVendor,
  isVisionModel,
  LLM_VENDORS,
  LLM_PURPOSES,
  DEFAULT_CONFIGS,
  type LLMVendor
} from "./llm/providers.js";

/**
 * Initialize LLM configuration.
 * Validates all LLM configs at startup to fail fast on misconfiguration.
 * Call this during application initialization before using any LLM features.
 *
 * @throws Error if any LLM configuration is invalid
 */
export { validateAllLLMConfigs as initializeLLM } from "./config.js";

// Constants
export {
  AGENT_NAMES,
  AGENT_JOAN,
  AGENT_JUAN,
  AGENT_MARIA,
  VALID_AGENT_NAMES,
  ROLE_TO_AGENT,
  GUEST_AGENT,
  type AgentName
} from "./constants.js";
