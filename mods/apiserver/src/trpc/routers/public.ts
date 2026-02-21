/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { loginSchema } from "@mikro/common";
import { createLogin } from "../../api/index.js";
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
  })),

  /**
   * Login with phone and password. Returns a JWT for use as Bearer token.
   */
  login: publicProcedure.input(loginSchema).mutation(async ({ ctx, input }) => {
    const fn = createLogin(ctx.db);
    return fn(input);
  })
});
