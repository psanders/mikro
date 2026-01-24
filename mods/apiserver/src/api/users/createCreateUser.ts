/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  createUserSchema,
  type CreateUserInput,
  type DbClient,
  type User
} from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function to create a new user.
 *
 * @param client - The database client
 * @returns A validated function that creates a user
 */
export function createCreateUser(client: DbClient) {
  const fn = async (params: CreateUserInput): Promise<User> => {
    const { role, ...userData } = params;
    logger.verbose("creating user", { name: userData.name, role });

    // Create the user
    const user = await client.user.create({
      data: {
        name: userData.name,
        phone: userData.phone
      }
    });

    // If a role is provided, create the user role
    if (role) {
      await client.userRole.create({
        data: {
          userId: user.id,
          role
        }
      });
      logger.verbose("user role assigned", { userId: user.id, role });
    }

    logger.verbose("user created", { id: user.id, name: user.name });
    return user;
  };

  return withErrorHandlingAndValidation(fn, createUserSchema);
}
