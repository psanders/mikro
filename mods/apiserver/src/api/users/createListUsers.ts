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

/**
 * Creates a function to list all users with optional pagination.
 * By default, only returns enabled users unless showDisabled is true.
 *
 * @param client - The database client
 * @returns A validated function that lists users
 */
export function createListUsers(client: DbClient) {
  const fn = async (params: ListUsersInput): Promise<User[]> => {
    return client.user.findMany({
      where: params.showDisabled ? undefined : { enabled: true },
      take: params.limit,
      skip: params.offset,
    });
  };

  return withErrorHandlingAndValidation(fn, listUsersSchema);
}
