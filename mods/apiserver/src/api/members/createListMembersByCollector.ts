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

/**
 * Creates a function to list members by assigned collector ID.
 *
 * @param client - The database client
 * @returns A validated function that lists members by collector
 */
export function createListMembersByCollector(client: DbClient) {
  const fn = async (params: ListMembersByCollectorInput): Promise<Member[]> => {
    return client.member.findMany({
      where: {
        assignedCollectorId: params.assignedCollectorId,
      },
      take: params.limit,
      skip: params.offset,
    });
  };

  return withErrorHandlingAndValidation(fn, listMembersByCollectorSchema);
}
