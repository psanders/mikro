/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listMembersByReferrerSchema,
  type ListMembersByReferrerInput,
  type DbClient,
  type Member,
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to list members by referrer ID.
 * By default, only returns active members unless showInactive is true.
 *
 * @param client - The database client
 * @returns A validated function that lists members by referrer
 */
export function createListMembersByReferrer(client: DbClient) {
  const fn = async (params: ListMembersByReferrerInput): Promise<Member[]> => {
    logger.verbose("listing members by referrer", { referrerId: params.referredById });
    const members = await client.member.findMany({
      where: {
        referredById: params.referredById,
        ...(params.showInactive ? {} : { isActive: true }),
      },
      take: params.limit,
      skip: params.offset,
    });
    logger.verbose("members by referrer listed", { referrerId: params.referredById, count: members.length });
    return members;
  };

  return withErrorHandlingAndValidation(fn, listMembersByReferrerSchema);
}
