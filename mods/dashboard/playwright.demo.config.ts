/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Records a narrated walkthrough of the renewal process against the REAL
 * stack: the same throwaway seeded apiserver + vite as the e2e suite, but a
 * single scripted run with video on. Not part of CI (testDir is `demo`, not
 * `e2e`).
 *
 *   npm run demo:renewal -w @mikro/dashboard      # then see demo-results/**\/video.webm
 */
import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

export default defineConfig({
  ...base,
  testDir: "demo",
  timeout: 15 * 60_000,
  retries: 0,
  reporter: "list",
  outputDir: "demo-results",
  use: {
    ...base.use,
    trace: "off",
    screenshot: "off",
    video: { mode: "on", size: { width: 1440, height: 900 } }
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }
    }
  ]
});
