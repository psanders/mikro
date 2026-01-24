/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * In-memory conversation store for guest users (unknown phone numbers).
 * Guest conversations are stored in memory until the user becomes a member,
 * at which point they are migrated to the database.
 */
import type { Message } from "../llm/types.js";
import { logger } from "../logger.js";

/**
 * In-memory storage for guest conversations.
 * Key: phone number, Value: array of messages
 */
const guestConversations = new Map<string, Message[]>();

/**
 * Get conversation history for a guest user.
 *
 * @param phone - The guest's phone number
 * @returns Array of messages (empty if no conversation exists)
 */
export function getGuestConversation(phone: string): Message[] {
  const messages = guestConversations.get(phone);
  logger.verbose("getting guest conversation", { phone, messageCount: messages?.length ?? 0 });
  return messages ?? [];
}

/**
 * Add a message to a guest's conversation history.
 *
 * @param phone - The guest's phone number
 * @param message - The message to add
 */
export function addGuestMessage(phone: string, message: Message): void {
  let messages = guestConversations.get(phone);
  if (!messages) {
    messages = [];
    guestConversations.set(phone, messages);
  }
  messages.push(message);
  logger.verbose("guest message added", {
    phone,
    role: message.role,
    messageCount: messages.length
  });
}

/**
 * Clear conversation history for a guest.
 * Called after the guest becomes a member and history is migrated.
 *
 * @param phone - The guest's phone number
 */
export function clearGuestConversation(phone: string): void {
  guestConversations.delete(phone);
  logger.verbose("guest conversation cleared", { phone });
}

/**
 * Check if a guest has an existing conversation.
 *
 * @param phone - The guest's phone number
 * @returns True if conversation exists
 */
export function hasGuestConversation(phone: string): boolean {
  return guestConversations.has(phone);
}

/**
 * Get all guest phone numbers with active conversations.
 * Useful for debugging and monitoring.
 *
 * @returns Array of phone numbers
 */
export function getActiveGuestPhones(): string[] {
  return Array.from(guestConversations.keys());
}

/**
 * Get total number of active guest conversations.
 *
 * @returns Number of active conversations
 */
export function getActiveGuestCount(): number {
  return guestConversations.size;
}
