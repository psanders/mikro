/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  getChatHistorySchema,
  type GetChatHistoryInput,
  type DbClient,
  type Message,
} from "@mikro/common";

/**
 * Creates a function to get chat history for a member or user.
 *
 * @param client - The database client
 * @returns A validated function that retrieves chat history
 */
export function createGetChatHistory(client: DbClient) {
  const fn = async (params: GetChatHistoryInput): Promise<Message[]> => {
    const where: { memberId?: string; userId?: string } = {};

    if (params.memberId) {
      where.memberId = params.memberId;
    } else if (params.userId) {
      where.userId = params.userId;
    }

    return client.message.findMany({
      where,
      include: {
        attachments: true,
      },
      orderBy: {
        createdAt: "asc",
      },
      take: params.limit,
      skip: params.offset,
    });
  };

  return withErrorHandlingAndValidation(fn, getChatHistorySchema);
}
