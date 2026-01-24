/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  listUsersSchema,
  type ListUsersInput,
  type DbClient,
  type User,
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to list all users with optional pagination.
 * By default, only returns enabled users unless showDisabled is true.
 *
 * @param client - The database client
 * @returns A validated function that lists users
 */
export function createListUsers(client: DbClient) {
  const fn = async (params: ListUsersInput): Promise<User[]> => {
    logger.verbose("listing users", { limit: params.limit, offset: params.offset });
    const users = await client.user.findMany({
      where: params.showDisabled ? undefined : { enabled: true },
      take: params.limit,
      skip: params.offset,
    });
    logger.verbose("users listed", { count: users.length });
    return users;
  };

  return withErrorHandlingAndValidation(fn, listUsersSchema);
}
