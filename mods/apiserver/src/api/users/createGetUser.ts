/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  getUserSchema,
  type GetUserInput,
  type DbClient,
  type User,
} from "@mikro/common";

/**
 * Creates a function to get a user by ID.
 *
 * @param client - The database client
 * @returns A validated function that retrieves a user
 */
export function createGetUser(client: DbClient) {
  const fn = async (params: GetUserInput): Promise<User | null> => {
    return client.user.findUnique({
      where: { id: params.id },
    });
  };

  return withErrorHandlingAndValidation(fn, getUserSchema);
}
