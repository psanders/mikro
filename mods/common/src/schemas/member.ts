/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";
import { validateDominicanPhone } from "../utils/validatePhone.js";

/**
 * Schema for creating a new member.
 */
export const createMemberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z
    .string()
    .min(1, "Phone is required")
    .transform((val) => {
      // Validate and normalize phone (strips +)
      return validateDominicanPhone(val);
    }),
  idNumber: z
    .string()
    .min(1, "ID number is required")
    .regex(/^\d{3}-\d{7}-\d{1}$/, "ID number must be in format 000-0000000-0"),
  collectionPoint: z.string().url("Collection point must be a valid URL"),
  homeAddress: z.string().min(1, "Home address is required"),
  jobPosition: z.string().optional(),
  income: z.number().optional(),
  isBusinessOwner: z.boolean().optional(),
  createdById: z.uuid().optional(),
  referredById: z.uuid({ error: "Invalid referrer ID" }),
  assignedCollectorId: z.uuid({ error: "Invalid collector ID" }),
  notes: z.string().optional(),
});

/**
 * Schema for updating an existing member.
 * Only name, phone, notes, and isActive can be updated.
 */
export const updateMemberSchema = z.object({
  id: z.uuid({ error: "Invalid member ID" }),
  name: z.string().min(1, "Name is required").optional(),
  phone: z
    .string()
    .min(1, "Phone is required")
    .transform((val) => {
      // Validate and normalize phone (strips +)
      return validateDominicanPhone(val);
    })
    .optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

/**
 * Schema for getting a member by ID.
 */
export const getMemberSchema = z.object({
  id: z.uuid({ error: "Invalid member ID" }),
});

/**
 * Schema for getting a member by phone number.
 */
export const getMemberByPhoneSchema = z.object({
  phone: z.string().min(1, "Phone number is required"),
});

/**
 * Schema for listing members with optional pagination.
 * By default only shows active members unless showInactive is true.
 */
export const listMembersSchema = z.object({
  showInactive: z.boolean().optional(), // If true, show all members including inactive
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional(),
});

/**
 * Schema for listing members by referrer.
 * By default only shows active members unless showInactive is true.
 */
export const listMembersByReferrerSchema = z.object({
  referredById: z.uuid({ error: "Invalid referrer ID" }),
  showInactive: z.boolean().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional(),
});

/**
 * Schema for listing members by collector.
 * By default only shows active members unless showInactive is true.
 */
export const listMembersByCollectorSchema = z.object({
  assignedCollectorId: z.uuid({ error: "Invalid collector ID" }),
  showInactive: z.boolean().optional(),
  limit: z.number().int().positive().max(100).optional(),
  offset: z.number().int().nonnegative().optional(),
});

/**
 * Input type for creating a member.
 */
export type CreateMemberInput = z.infer<typeof createMemberSchema>;

/**
 * Input type for updating a member.
 */
export type UpdateMemberInput = z.infer<typeof updateMemberSchema>;

/**
 * Input type for getting a member.
 */
export type GetMemberInput = z.infer<typeof getMemberSchema>;

/**
 * Input type for getting a member by phone.
 */
export type GetMemberByPhoneInput = z.infer<typeof getMemberByPhoneSchema>;

/**
 * Input type for listing members.
 */
export type ListMembersInput = z.infer<typeof listMembersSchema>;

/**
 * Input type for listing members by referrer.
 */
export type ListMembersByReferrerInput = z.infer<typeof listMembersByReferrerSchema>;

/**
 * Input type for listing members by collector.
 */
export type ListMembersByCollectorInput = z.infer<typeof listMembersByCollectorSchema>;
