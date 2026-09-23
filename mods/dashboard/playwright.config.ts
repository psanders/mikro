/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * End-to-end tests for the Ops app against a REAL apiserver on a throwaway
 * SQLite database (e2e/prepare.mjs: keys → migrate deploy → deterministic
 * seed). One worker: the specs share that database and each drives its own
 * seeded application through the review flow.
 *
 *   npm run test:e2e:dashboard      (from the repo root; builds first)
 */
import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const API_PORT = 4199;
const WEB_PORT = 5199;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
    locale: "es-DO",
    timezoneId: "America/Santo_Domingo"
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }
    }
  ],
  webServer: [
    {
      command: "node e2e/prepare.mjs && node ../apiserver/dist/index.js",
      port: API_PORT,
      env: { MIKRO_CONFIG_FILE: resolve(here, "e2e/mikro.e2e.json") },
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "ignore",
      stderr: "pipe"
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      port: WEB_PORT,
      env: { VITE_API_URL: `http://localhost:${API_PORT}`, VITE_DISABLE_AUTO_UPDATE: "1" },
      reuseExistingServer: false,
      timeout: 120_000
    }
  ]
});
