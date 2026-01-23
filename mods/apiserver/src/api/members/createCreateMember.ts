 /**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  createMemberSchema,
  type CreateMemberInput,
  type DbClient,
  type Member,
} from "@mikro/common";

/**
 * Creates a function to create a new member.
 *
 * @param client - The database client
 * @returns A validated function that creates a member
 */
export function createCreateMember(client: DbClient) {
  const fn = async (params: CreateMemberInput): Promise<Member> => {
    return client.member.create({
      data: params,
    });
  };

  return withErrorHandlingAndValidation(fn, createMemberSchema);
}
