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

/**
 * Creates a function to list all members with optional pagination.
 *
 * @param client - The database client
 * @returns A validated function that lists members
 */
export function createListMembers(client: DbClient) {
  const fn = async (params: ListMembersInput): Promise<Member[]> => {
    return client.member.findMany({
      take: params.limit,
      skip: params.offset,
    });
  };

  return withErrorHandlingAndValidation(fn, listMembersSchema);
}
