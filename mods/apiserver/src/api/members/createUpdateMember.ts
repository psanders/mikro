/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  updateMemberSchema,
  type UpdateMemberInput,
  type DbClient,
  type Member
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to update an existing member.
 * Only name, phone, note, and isActive can be updated.
 * Phone is validated and normalized to E.164 format via Zod schema transform if provided.
 *
 * @param client - The database client
 * @returns A validated function that updates a member
 */
export function createUpdateMember(client: DbClient) {
  const fn = async (params: UpdateMemberInput): Promise<Member> => {
    const { id, ...updateData } = params;
    logger.verbose("updating member", { id, fields: Object.keys(updateData) });
    const member = await client.member.update({
      where: { id },
      data: updateData
    });
    logger.verbose("member updated", { id: member.id });
    return member;
  };

  return withErrorHandlingAndValidation(fn, updateMemberSchema);
}
