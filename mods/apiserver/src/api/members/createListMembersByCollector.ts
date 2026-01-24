/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listMembersByCollectorSchema,
  type ListMembersByCollectorInput,
  type DbClient,
  type Member,
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to list members by assigned collector ID.
 * By default, only returns active members unless showInactive is true.
 *
 * @param client - The database client
 * @returns A validated function that lists members by collector
 */
export function createListMembersByCollector(client: DbClient) {
  const fn = async (params: ListMembersByCollectorInput): Promise<Member[]> => {
    logger.verbose("listing members by collector", { collectorId: params.assignedCollectorId });
    const members = await client.member.findMany({
      where: {
        assignedCollectorId: params.assignedCollectorId,
        ...(params.showInactive ? {} : { isActive: true }),
      },
      take: params.limit,
      skip: params.offset,
    });
    logger.verbose("members by collector listed", { collectorId: params.assignedCollectorId, count: members.length });
    return members;
  };

  return withErrorHandlingAndValidation(fn, listMembersByCollectorSchema);
}
