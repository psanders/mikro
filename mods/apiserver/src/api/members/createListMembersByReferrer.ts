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

/**
 * Creates a function to list members by referrer ID.
 * By default, only returns active members unless showInactive is true.
 *
 * @param client - The database client
 * @returns A validated function that lists members by referrer
 */
export function createListMembersByReferrer(client: DbClient) {
  const fn = async (params: ListMembersByReferrerInput): Promise<Member[]> => {
    return client.member.findMany({
      where: {
        referredById: params.referredById,
        ...(params.showInactive ? {} : { isActive: true }),
      },
      take: params.limit,
      skip: params.offset,
    });
  };

  return withErrorHandlingAndValidation(fn, listMembersByReferrerSchema);
}
