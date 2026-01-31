/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  getUserSchema,
  type GetUserInput,
  type DbClient,
  type User,
  type Role
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to get a user by ID.
 *
 * @param client - The database client
 * @returns A validated function that retrieves a user
 */
export function createGetUser(client: DbClient) {
  const fn = async (params: GetUserInput): Promise<(User & { roles?: Array<{ role: Role }> }) | null> => {
    logger.verbose("getting user", { id: params.id });
    const user = await client.user.findUnique({
      where: { id: params.id },
      include: { roles: { select: { role: true } } }
    });
    logger.verbose("user retrieved", { id: params.id, found: !!user });
    return user;
  };

  return withErrorHandlingAndValidation(fn, getUserSchema);
}
