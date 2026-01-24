/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  getMemberByPhoneSchema,
  type GetMemberByPhoneInput,
  type DbClient,
  type Member
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to get a member by phone number.
 *
 * @param client - The database client
 * @returns A validated function that retrieves a member by phone
 */
export function createGetMemberByPhone(client: DbClient) {
  const fn = async (params: GetMemberByPhoneInput): Promise<Member | null> => {
    logger.verbose("getting member by phone", { phone: params.phone });
    const member = await client.member.findFirst({
      where: { phone: params.phone }
    });
    logger.verbose("member by phone retrieved", { phone: params.phone, found: !!member });
    return member;
  };

  return withErrorHandlingAndValidation(fn, getMemberByPhoneSchema);
}
