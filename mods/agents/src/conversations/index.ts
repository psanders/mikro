/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
export {
  getGuestConversation,
  addGuestMessage,
  clearGuestConversation,
  hasGuestConversation,
  getActiveGuestPhones,
  getActiveGuestCount
} from "./inMemoryStore.js";

export { migrateGuestToDatabase } from "./migrateToDatabase.js";
