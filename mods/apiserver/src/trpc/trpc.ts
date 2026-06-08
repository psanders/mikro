/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context.js";

/**
 * Initialize tRPC with context type.
 */
const t = initTRPC.context<Context>().create();

/**
 * Router factory for creating tRPC routers.
 */
export const router = t.router;

/**
 * Merge multiple routers into a single flat router.
 */
export const mergeRouters = t.mergeRouters;

/**
 * Public procedure - no authentication required.
 */
export const publicProcedure = t.procedure;

/**
 * Protected procedure - requires a valid Bearer JWT.
 * Narrows `ctx.userId` to a guaranteed string so downstream handlers can
 * trust the caller's identity.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.isAuthenticated || !ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      userId: ctx.userId,
      roles: ctx.roles
    }
  });
});

/**
 * Admin procedure - requires a valid JWT whose user has the ADMIN role.
 * Use this for operations that must be restricted to administrators
 * (e.g. user management, destructive overrides). Currently unused while we
 * keep transition-era backwards compatibility, but ready to gate routes.
 */
export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.roles.includes("ADMIN")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin role required" });
  }
  return next();
});

/**
 * Reviewer procedure - requires a valid JWT whose user has the ADMIN or REVIEWER
 * role. Use this for loan-application review actions (claim/approve/reject/reopen).
 */
export const reviewerProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (!ctx.roles.includes("ADMIN") && !ctx.roles.includes("REVIEWER")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Reviewer or admin role required" });
  }
  return next();
});
