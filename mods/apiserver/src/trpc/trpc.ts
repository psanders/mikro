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
 * Protected procedure - requires Basic Auth.
 * Throws UNAUTHORIZED error if not authenticated.
 */
export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.isAuthenticated) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next();
});
