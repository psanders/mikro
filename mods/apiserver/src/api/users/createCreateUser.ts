/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import bcrypt from "bcryptjs";
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
    const { role, password, ...userData } = params as CreateUserInput & { password?: string };
    logger.verbose("creating user", { name: userData.name, role });

    const data: { name: string; phone: string; password?: string } = {
      name: userData.name,
      phone: userData.phone
    };
    if (password !== undefined && password !== "") {
      data.password = await bcrypt.hash(password, 10);
    }

    // Create the user
    const user = await client.user.create({
      data
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
    const safe = { ...user } as User & { password?: string | null };
    delete safe.password;
    return safe as User;
  };

  return withErrorHandlingAndValidation(fn, createUserSchema);
}
