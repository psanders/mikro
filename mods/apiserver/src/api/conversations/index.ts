/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
export {
  CX_HISTORY_TURNS,
  CX_HISTORY_MAX_AGE_MS,
  PROSPECT_HISTORY_TURNS,
  createRecordConversationTurn,
  createGetConversationHistory,
  createListConversationTurns,
  createGetApplicationConversation,
  createDeleteConversation,
  toTurnView,
  type ConversationTurnView,
  type ApplicationConversation
} from "./conversations.js";
