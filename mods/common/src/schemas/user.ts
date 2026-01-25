/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";
import { validateDominicanPhone } from "../utils/validatePhone.js";

/**
 * Role enum matching Prisma schema.
 */
export const roleEnum = z.enum(["ADMIN", "COLLECTOR", "REFERRER"]);

/**
 * Schema for creating a new user.
 */
export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  role: roleEnum.optional()
});

/**
 * Schema for updating an existing user.
 * Only name, phone, and enabled can be updated.
 * Phone is validated and normalized to E.164 format if provided.
 */
export const updateUserSchema = z.object({
  id: z.uuid({ error: "Invalid user ID" }),
  name: z.string().min(1, "Name is required").optional(),
  phone: z
    .string()
    .transform((val) => {
      // Validate and normalize phone to E.164 format
      return validateDominicanPhone(val);
    })
    .optional(),
  enabled: z.boolean().optional()
});

/**
 * Schema for getting a user by ID.
 */
export const getUserSchema = z.object({
  id: z.uuid({ error: "Invalid user ID" })
});

/**
 * Schema for getting a user by phone number.
 */
export const getUserByPhoneSchema = z.object({
  phone: z
    .string()
    .min(1, "Phone number is required")
    .transform((val) => {
      // Validate and normalize phone to E.164 format
      return validateDominicanPhone(val);
    })
});

/**
 * Schema for listing users with optional pagination.
 * By default only shows enabled users unless showDisabled is true.
 */
export const listUsersSchema = z.object({
  showDisabled: z.boolean().optional(), // If true, show all users including disabled
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional()
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
 * Input type for getting a user by phone.
 */
export type GetUserByPhoneInput = z.infer<typeof getUserByPhoneSchema>;

/**
 * Input type for listing users.
 */
export type ListUsersInput = z.infer<typeof listUsersSchema>;

/**
 * Role type.
 */
export type Role = z.infer<typeof roleEnum>;
