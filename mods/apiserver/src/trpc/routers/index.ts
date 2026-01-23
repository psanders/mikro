/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { router } from "../trpc.js";
import { publicRouter } from "./public.js";
import { protectedRouter } from "./protected.js";

/**
 * Main application router combining all sub-routers.
 */
export const appRouter = router({
  ...publicRouter._def.procedures,
  ...protectedRouter._def.procedures,
});

/**
 * Type definition for the app router.
 * Export this for use in tRPC clients.
 */
export type AppRouter = typeof appRouter;
