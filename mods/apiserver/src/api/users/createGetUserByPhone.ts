/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  getUserByPhoneSchema,
  type GetUserByPhoneInput,
  type DbClient,
  type User,
  type Role
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * User with roles information.
 */
export interface UserWithRoles extends User {
  roles: Array<{ role: Role }>;
}

/**
 * Creates a function to get a user by phone number.
 * Includes the user's roles for routing decisions.
 *
 * @param client - The database client
 * @returns A validated function that retrieves a user by phone
 */
export function createGetUserByPhone(client: DbClient) {
  const fn = async (params: GetUserByPhoneInput): Promise<UserWithRoles | null> => {
    logger.verbose("getting user by phone", { phone: params.phone });
    const user = await client.user.findFirst({
      where: { phone: params.phone },
      include: {
        roles: {
          select: { role: true }
        }
      }
    });
    logger.verbose("user by phone retrieved", { phone: params.phone, found: !!user });
    return user as UserWithRoles | null;
  };

  return withErrorHandlingAndValidation(fn, getUserByPhoneSchema);
}
