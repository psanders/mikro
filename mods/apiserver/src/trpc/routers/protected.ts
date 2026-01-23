/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  // Member schemas
  createMemberSchema,
  updateMemberSchema,
  getMemberSchema,
  listMembersSchema,
  listMembersByReferrerSchema,
  listMembersByCollectorSchema,
  // User schemas
  createUserSchema,
  updateUserSchema,
  getUserSchema,
  // Chat schemas
  getChatHistorySchema,
} from "@mikro/common";
import { router, protectedProcedure } from "../trpc.js";
// Member API functions
import { createCreateMember } from "../../api/members/createCreateMember.js";
import { createUpdateMember } from "../../api/members/createUpdateMember.js";
import { createGetMember } from "../../api/members/createGetMember.js";
import { createListMembers } from "../../api/members/createListMembers.js";
import { createListMembersByReferrer } from "../../api/members/createListMembersByReferrer.js";
import { createListMembersByCollector } from "../../api/members/createListMembersByCollector.js";
// User API functions
import { createCreateUser } from "../../api/users/createCreateUser.js";
import { createUpdateUser } from "../../api/users/createUpdateUser.js";
import { createGetUser } from "../../api/users/createGetUser.js";
// Chat API functions
import { createGetChatHistory } from "../../api/chat/createGetChatHistory.js";

/**
 * Protected router - procedures that require Basic Auth.
 */
export const protectedRouter = router({
  // ==================== Member procedures ====================

  /**
   * Create a new member.
   */
  createMember: protectedProcedure
    .input(createMemberSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createCreateMember(ctx.db);
      return fn(input);
    }),

  /**
   * Update an existing member.
   */
  updateMember: protectedProcedure
    .input(updateMemberSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createUpdateMember(ctx.db);
      return fn(input);
    }),

  /**
   * Get a member by ID.
   */
  getMember: protectedProcedure
    .input(getMemberSchema)
    .query(async ({ ctx, input }) => {
      const fn = createGetMember(ctx.db);
      return fn(input);
    }),

  /**
   * List all members with optional pagination.
   */
  listMembers: protectedProcedure
    .input(listMembersSchema)
    .query(async ({ ctx, input }) => {
      const fn = createListMembers(ctx.db);
      return fn(input);
    }),

  /**
   * List members by referrer ID.
   */
  listMembersByReferrer: protectedProcedure
    .input(listMembersByReferrerSchema)
    .query(async ({ ctx, input }) => {
      const fn = createListMembersByReferrer(ctx.db);
      return fn(input);
    }),

  /**
   * List members by collector ID.
   */
  listMembersByCollector: protectedProcedure
    .input(listMembersByCollectorSchema)
    .query(async ({ ctx, input }) => {
      const fn = createListMembersByCollector(ctx.db);
      return fn(input);
    }),

  // ==================== User procedures ====================

  /**
   * Create a new user.
   */
  createUser: protectedProcedure
    .input(createUserSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createCreateUser(ctx.db);
      return fn(input);
    }),

  /**
   * Update an existing user.
   */
  updateUser: protectedProcedure
    .input(updateUserSchema)
    .mutation(async ({ ctx, input }) => {
      const fn = createUpdateUser(ctx.db);
      return fn(input);
    }),

  /**
   * Get a user by ID.
   */
  getUser: protectedProcedure
    .input(getUserSchema)
    .query(async ({ ctx, input }) => {
      const fn = createGetUser(ctx.db);
      return fn(input);
    }),

  // ==================== Chat procedures ====================

  /**
   * Get chat history for a member or user.
   */
  getChatHistory: protectedProcedure
    .input(getChatHistorySchema)
    .query(async ({ ctx, input }) => {
      const fn = createGetChatHistory(ctx.db);
      return fn(input);
    }),
});
