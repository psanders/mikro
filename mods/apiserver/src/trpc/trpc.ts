/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import type { BusinessEventType } from "@mikro/common";
import type { Context } from "./context.js";
import { eventMappers } from "../api/events/mappers.js";
import { recordEvent, type EventClient } from "../api/events/index.js";
import { logger } from "../logger.js";

/**
 * Per-procedure metadata. A procedure that produces a business event declares
 * it with `.meta({ event: "<type>" })`; the event-capture middleware below reads
 * this after the resolver succeeds. See `src/api/events/mappers.ts`.
 */
export interface Meta {
  event?: BusinessEventType;
}

/**
 * Initialize tRPC with context and meta types.
 */
const t = initTRPC.context<Context>().meta<Meta>().create();

/**
 * Business-event capture at the tRPC boundary (design Decision 1). Runs on every
 * protected procedure but only acts when the procedure carries `.meta({ event })`.
 * After the resolver succeeds it looks up the mapper for that event type, builds a
 * `RecordBusinessEventInput` from `(input, result, ctx)`, and appends it to the
 * log via `recordEvent`. A mapper or write failure AFTER a committed mutation is
 * logged loudly and swallowed — it never turns a successful mutation into an
 * error. A failed resolver (result not ok) writes nothing. Event types produced
 * intrinsically elsewhere (e.g. `application.restored`) have no mapper and are
 * skipped here so they are never double-written.
 */
const eventCapture = t.middleware(async (opts) => {
  const result = await opts.next();
  const eventType = opts.meta?.event;
  if (!result.ok || !eventType) return result;

  const mapper = eventMappers[eventType];
  if (!mapper) return result;

  try {
    let rawInput: unknown;
    try {
      rawInput = await opts.getRawInput();
    } catch {
      rawInput = undefined;
    }
    const mapped = await mapper({ input: rawInput, result: result.data, ctx: opts.ctx });
    if (mapped) {
      await recordEvent(opts.ctx.db as unknown as EventClient, mapped);
    }
  } catch (error) {
    logger.error("failed to record business event after successful mutation", {
      event: eventType,
      error: (error as Error).message
    });
  }

  return result;
});

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
export const protectedProcedure = t.procedure
  .use(({ ctx, next }) => {
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
  })
  // Event capture runs with the authenticated ctx and wraps the resolver so it
  // sees the mutation's result; it is a no-op unless the procedure sets meta.event.
  .use(eventCapture);

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
