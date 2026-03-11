/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Runs once before any tests.
 * Registers a process handler for the Fonoster stream error so that if a
 * stream is ever opened, its timeout/close error is swallowed and does not
 * crash the test run (index.ts is not loaded).
 * Sets MIKRO_CONFIG_FILE so getConfig() resolves when not set by the runner.
 */

import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Always set so getConfig() resolves in tests (runner or preload may not have run)
process.env.MIKRO_CONFIG_FILE = path.resolve(__dirname, "fixtures/mikro.json");

const FONOSTER_TRACKING_MSG = "An error occurred while tracking the call";
process.on("uncaughtException", (err) => {
  if (err?.message === FONOSTER_TRACKING_MSG) return;
  console.error(err);
  process.exit(1);
});
