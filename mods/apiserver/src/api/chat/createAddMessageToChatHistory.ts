/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  addMessageSchema,
  type AddMessageInput,
  type DbClient,
  type Message
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to add a message to chat history.
 * Supports messages for either a member or a user, with optional attachments.
 *
 * @param client - The database client
 * @returns A validated function that adds a message to chat history
 */
export function createAddMessageToChatHistory(client: DbClient) {
  const fn = async (params: AddMessageInput): Promise<Message> => {
    const { attachments, ...messageData } = params;
    logger.verbose("adding message to chat history", {
      role: messageData.role,
      memberId: messageData.memberId,
      userId: messageData.userId
    });

    // Create the message
    const message = await client.message.create({
      data: {
        role: messageData.role,
        content: messageData.content,
        tools: messageData.tools ? JSON.stringify(messageData.tools) : undefined,
        memberId: messageData.memberId,
        userId: messageData.userId
      }
    });

    // Create attachments if provided
    if (attachments && attachments.length > 0) {
      await client.attachment.createMany({
        data: attachments.map((attachment) => ({
          ...attachment,
          messageId: message.id
        }))
      });
      logger.verbose("attachments added to message", {
        messageId: message.id,
        count: attachments.length
      });
    }

    logger.verbose("message added to chat history", { id: message.id });
    return message;
  };

  return withErrorHandlingAndValidation(fn, addMessageSchema);
}
