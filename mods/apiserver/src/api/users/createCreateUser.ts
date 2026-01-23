/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  withErrorHandlingAndValidation,
  createUserSchema,
  type CreateUserInput,
  type DbClient,
  type User,
} from "@mikro/common";

/**
 * Creates a function to create a new user.
 *
 * @param client - The database client
 * @returns A validated function that creates a user
 */
export function createCreateUser(client: DbClient) {
  const fn = async (params: CreateUserInput): Promise<User> => {
    const { role, ...userData } = params;

    // Create the user
    const user = await client.user.create({
      data: {
        name: userData.name,
        phone: userData.phone,
      },
    });

    // If a role is provided, create the user role
    if (role) {
      await client.userRole.create({
        data: {
          userId: user.id,
          role,
        },
      });
    }

    return user;
  };

  return withErrorHandlingAndValidation(fn, createUserSchema);
}
