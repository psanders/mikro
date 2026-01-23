/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  getMemberSchema,
  type GetMemberInput,
  type DbClient,
  type Member,
} from "@mikro/common";

/**
 * Creates a function to get a member by ID.
 *
 * @param client - The database client
 * @returns A validated function that retrieves a member
 */
export function createGetMember(client: DbClient) {
  const fn = async (params: GetMemberInput): Promise<Member | null> => {
    return client.member.findUnique({
      where: { id: params.id },
    });
  };

  return withErrorHandlingAndValidation(fn, getMemberSchema);
}
