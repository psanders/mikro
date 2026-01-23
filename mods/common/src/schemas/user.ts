/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";

/**
 * Role enum matching Prisma schema.
 */
export const roleEnum = z.enum(["ADMIN", "COLLECTOR", "REFERRER"]);

/**
 * Schema for creating a new user.
 */
export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().optional(),
  role: roleEnum.optional(),
});

/**
 * Schema for updating an existing user.
 * Only name, phone, and enabled can be updated.
 */
export const updateUserSchema = z.object({
  id: z.uuid({ error: "Invalid user ID" }),
  name: z.string().min(1, "Name is required").optional(),
  phone: z.string().optional(),
  enabled: z.boolean().optional(),
});

/**
 * Schema for getting a user by ID.
 */
export const getUserSchema = z.object({
  id: z.uuid({ error: "Invalid user ID" }),
});

/**
 * Input type for creating a user.
 */
export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * Input type for updating a user.
 */
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

/**
 * Input type for getting a user.
 */
export type GetUserInput = z.infer<typeof getUserSchema>;

/**
 * Role type.
 */
export type Role = z.infer<typeof roleEnum>;
