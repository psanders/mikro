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
import { logger } from "../../logger.js";

/**
 * Creates a function to create a new member.
 * Phone is validated and normalized (strips +) via Zod schema transform.
 * Referrer and collector are required.
 *
 * @param client - The database client
 * @returns A validated function that creates a member
 */
export function createCreateMember(client: DbClient) {
  const fn = async (params: CreateMemberInput): Promise<Member> => {
    logger.verbose("creating member", { phone: params.phone, name: params.name });
    const member = await client.member.create({
      data: params,
    });
    logger.verbose("member created", { id: member.id, phone: member.phone });
    return member;
  };

  return withErrorHandlingAndValidation(fn, createMemberSchema);
}
