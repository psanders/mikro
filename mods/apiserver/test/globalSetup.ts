/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Runs once before any tests.
 * 1. Forces Fonoster off so no real gRPC streams are opened during tests.
 * 2. Registers a process handler for the Fonoster stream error so that if a
 *    stream is ever opened (e.g. env from .env), its timeout/close error
 *    is swallowed and does not crash the test run (index.ts is not loaded).
 */
process.env.MIKRO_FONOSTER_ENABLED = "false";

// If a Fonoster stream was ever opened (e.g. MIKRO_FONOSTER_ENABLED from .env),
// its timeout/close can emit this uncaught error. Swallow it so the test run
// does not crash; index.ts does the same when the server runs.
const FONOSTER_TRACKING_MSG = "An error occurred while tracking the call";
process.on("uncaughtException", (err) => {
  if (err?.message === FONOSTER_TRACKING_MSG) return;
  // All other errors: log and exit (Node would exit anyway)
  console.error(err);
  process.exit(1);
});
