/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  getChatHistorySchema,
  type GetChatHistoryInput,
  type DbClient,
  type Message
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to get chat history for a customer or user.
 *
 * @param client - The database client
 * @returns A validated function that retrieves chat history
 */
export function createGetChatHistory(client: DbClient) {
  const fn = async (params: GetChatHistoryInput): Promise<Message[]> => {
    logger.verbose("getting chat history", {
      customerId: params.customerId,
      userId: params.userId
    });
    const where: { customerId?: string; userId?: string } = {};

    if (params.customerId) {
      where.customerId = params.customerId;
    } else if (params.userId) {
      where.userId = params.userId;
    }

    const messages = await client.message.findMany({
      where,
      include: {
        attachments: true
      },
      orderBy: {
        createdAt: "asc"
      },
      take: params.limit,
      skip: params.offset
    });
    logger.verbose("chat history retrieved", { count: messages.length });
    return messages;
  };

  return withErrorHandlingAndValidation(fn, getChatHistorySchema);
}
