/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  updateUserSchema,
  type UpdateUserInput,
  type DbClient,
  type User
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to update an existing user.
 * Name, phone, enabled, and role can be updated.
 * Phone is validated and normalized to E.164 format via Zod schema transform if provided.
 * When role is provided, it replaces all existing roles for the user.
 *
 * @param client - The database client
 * @returns A validated function that updates a user
 */
export function createUpdateUser(client: DbClient) {
  const fn = async (params: UpdateUserInput): Promise<User> => {
    const { id, role, ...updateData } = params;
    logger.verbose("updating user", { id, fields: Object.keys(updateData) });

    const user = await client.user.update({
      where: { id },
      data: updateData
    });

    if (role) {
      await client.userRole.deleteMany({ where: { userId: id } });
      await client.userRole.create({ data: { userId: id, role } });
      logger.verbose("user role updated", { id, role });
    }

    logger.verbose("user updated", { id: user.id });
    return user;
  };

  return withErrorHandlingAndValidation(fn, updateUserSchema);
}
