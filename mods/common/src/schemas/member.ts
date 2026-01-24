/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod/v4";

/**
 * Schema for creating a new member.
 */
export const createMemberSchema = z.object({
  name: z.string().min(1, "Name is required"),
  phone: z.string().min(1, "Phone is required"),
  idNumber: z.string().min(1, "ID number is required"),
  collectionPoint: z.string().min(1, "Collection point is required"),
  homeAddress: z.string().min(1, "Home address is required"),
  jobPosition: z.string().optional(),
  income: z.number().optional(),
  isBusinessOwner: z.boolean().optional(),
  createdById: z.uuid().optional(),
  referredById: z.uuid().optional(),
  assignedCollectorId: z.uuid().optional(),
});

/**
 * Schema for updating an existing member.
 * Only name, phone, and isActive can be updated.
 */
export const updateMemberSchema = z.object({
  id: z.uuid({ error: "Invalid member ID" }),
  name: z.string().min(1, "Name is required").optional(),
  phone: z.string().min(1, "Phone is required").optional(),
  isActive: z.boolean().optional(),
});

/**
 * Schema for getting a member by ID.
 */
export const getMemberSchema = z.object({
  id: z.uuid({ error: "Invalid member ID" }),
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
