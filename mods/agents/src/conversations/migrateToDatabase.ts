/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Migrate guest conversation history to the database after member creation.
 */
import type { Message, MessageContentItem } from "../llm/types.js";
import { getGuestConversation, clearGuestConversation } from "./inMemoryStore.js";
import { logger } from "../logger.js";

/**
 * Function type for adding a message to the database.
 */
export type AddMessageToDb = (params: {
  memberId: string;
  role: "AI" | "HUMAN";
  content: string;
  attachments?: Array<{
    type: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
    url: string;
    name?: string;
    mimeType?: string;
  }>;
}) => Promise<{ id: string }>;

/**
 * Convert LLM message role to database role.
 */
function convertRole(role: Message["role"]): "AI" | "HUMAN" {
  switch (role) {
    case "assistant":
      return "AI";
    case "user":
      return "HUMAN";
    default:
      // Tool and system messages are not stored in the database
      return "AI";
  }
}

/**
 * Extract text content from a message.
 */
function extractContent(content: string | MessageContentItem[]): string {
  if (typeof content === "string") {
    return content;
  }

  // For array content, extract text items
  const textItems = content.filter(item => item.type === "text");
  return textItems.map(item => item.text ?? "").join("\n");
}

/**
 * Extract image attachments from a message.
 */
function extractImageAttachments(content: string | MessageContentItem[]): Array<{
  type: "IMAGE";
  url: string;
}> {
  if (typeof content === "string") {
    return [];
  }

  return content
    .filter(item => item.type === "image_url" && item.image_url?.url)
    .map(item => ({
      type: "IMAGE" as const,
      url: item.image_url!.url
    }));
}

/**
 * Migrate guest conversation history to the database.
 * Called after a guest becomes a member.
 *
 * @param phone - The guest's phone number (used as lookup key)
 * @param memberId - The new member's ID in the database
 * @param addMessage - Function to add messages to the database
 */
export async function migrateGuestToDatabase(
  phone: string,
  memberId: string,
  addMessage: AddMessageToDb
): Promise<void> {
  const messages = getGuestConversation(phone);

  if (messages.length === 0) {
    logger.verbose("no guest messages to migrate", { phone, memberId });
    return;
  }

  logger.verbose("migrating guest conversation to database", {
    phone,
    memberId,
    messageCount: messages.length
  });

  // Migrate each message (skip system and tool messages)
  for (const message of messages) {
    // Skip system and tool messages - they don't need to be stored
    if (message.role === "system" || message.role === "tool") {
      continue;
    }

    const role = convertRole(message.role);
    const content = extractContent(message.content);
    const attachments = extractImageAttachments(message.content);

    // Skip empty messages
    if (!content && attachments.length === 0) {
      continue;
    }

    try {
      await addMessage({
        memberId,
        role,
        content: content || "[Image]",
        attachments: attachments.length > 0 ? attachments : undefined
      });
    } catch (error) {
      const err = error as Error;
      logger.error("failed to migrate message", {
        phone,
        memberId,
        role,
        error: err.message
      });
      // Continue with other messages even if one fails
    }
  }

  // Clear the in-memory conversation after migration
  clearGuestConversation(phone);

  logger.verbose("guest conversation migrated", { phone, memberId });
}
