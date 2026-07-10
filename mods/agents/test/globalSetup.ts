/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Runs once before any @mikro/agents test (wired via .mocharc.json `require`).
 * Sets MIKRO_CONFIG_FILE so `getConfig()` resolves to a known-valid test
 * config when a suite does not point it at its own temporary fixture — the
 * same pattern the apiserver test suite uses (test/globalSetup.ts). Suites
 * that build their own temp mikro.json (e.g. sessionStore, handleProspectMessage)
 * still override this by calling getConfig(TEST_CONFIG_PATH) explicitly.
 */
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Only set a default when the runner has not already provided one, so an
// explicit MIKRO_CONFIG_FILE from the environment still wins.
if (!process.env.MIKRO_CONFIG_FILE) {
  process.env.MIKRO_CONFIG_FILE = path.resolve(__dirname, "fixtures/mikro.json");
}
