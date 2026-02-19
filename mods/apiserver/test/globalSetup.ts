/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Runs once before any tests.
 * Registers a process handler for the Fonoster stream error so that if a
 * stream is ever opened, its timeout/close error is swallowed and does not
 * crash the test run (index.ts is not loaded).
 */

const FONOSTER_TRACKING_MSG = "An error occurred while tracking the call";
process.on("uncaughtException", (err) => {
  if (err?.message === FONOSTER_TRACKING_MSG) return;
  console.error(err);
  process.exit(1);
});
