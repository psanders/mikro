/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  updateUserSchema,
  type UpdateUserInput,
  type DbClient,
  type User,
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to update an existing user.
 * Only name, phone, and enabled can be updated.
 *
 * @param client - The database client
 * @returns A validated function that updates a user
 */
export function createUpdateUser(client: DbClient) {
  const fn = async (params: UpdateUserInput): Promise<User> => {
    const { id, ...updateData } = params;
    logger.verbose("updating user", { id, fields: Object.keys(updateData) });

    const user = await client.user.update({
      where: { id },
      data: updateData,
    });
    logger.verbose("user updated", { id: user.id });
    return user;
  };

  return withErrorHandlingAndValidation(fn, updateUserSchema);
}
