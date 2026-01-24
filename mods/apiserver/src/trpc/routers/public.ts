/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { router, publicProcedure } from "../trpc.js";

/**
 * Public router - procedures that don't require authentication.
 */
export const publicRouter = router({
  /**
   * Simple ping endpoint to verify the API is running.
   */
  ping: publicProcedure.query(() => ({
    message: "pong",
    timestamp: Date.now()
  }))
});
