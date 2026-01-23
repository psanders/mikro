/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  updateMemberSchema,
  type UpdateMemberInput,
  type DbClient,
  type Member,
} from "@mikro/common";

/**
 * Creates a function to update an existing member.
 * Only name, phone, and isActive can be updated.
 *
 * @param client - The database client
 * @returns A validated function that updates a member
 */
export function createUpdateMember(client: DbClient) {
  const fn = async (params: UpdateMemberInput): Promise<Member> => {
    const { id, ...updateData } = params;

    return client.member.update({
      where: { id },
      data: updateData,
    });
  };

  return withErrorHandlingAndValidation(fn, updateMemberSchema);
}
