/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listMembersSchema,
  type ListMembersInput,
  type DbClient,
  type Member,
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to list all members with optional pagination.
 * By default, only returns active members unless showInactive is true.
 *
 * @param client - The database client
 * @returns A validated function that lists members
 */
export function createListMembers(client: DbClient) {
  const fn = async (params: ListMembersInput): Promise<Member[]> => {
    logger.verbose("listing members", { limit: params.limit, offset: params.offset });
    const members = await client.member.findMany({
      where: params.showInactive ? undefined : { isActive: true },
      take: params.limit,
      skip: params.offset,
    });
    logger.verbose("members listed", { count: members.length });
    return members;
  };

  return withErrorHandlingAndValidation(fn, listMembersSchema);
}
