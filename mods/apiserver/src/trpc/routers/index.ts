/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { mergeRouters } from "../trpc.js";
import { publicRouter } from "./public.js";
import { protectedRouter } from "./protected.js";

/**
 * Main application router — merges public and protected procedures
 * into a single flat namespace.
 */
export const appRouter = mergeRouters(publicRouter, protectedRouter);

/**
 * Type definition for the app router.
 * Export this for use in tRPC clients.
 */
export type AppRouter = typeof appRouter;
