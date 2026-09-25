/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Builds a fresh, throwaway backend for the Playwright suite under e2e/.run:
 * receipt-signing keys, a new SQLite database with every migration applied
 * (`prisma migrate deploy`, the same path production uses), and the
 * deterministic seed (mods/apiserver/scripts/seed-e2e.mjs). Run by the
 * apiserver webServer command in playwright.config.ts before it boots.
 */
/* global console, process */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateKeys } from "../../common/dist/receipt/keygen.js";

const here = dirname(fileURLToPath(import.meta.url));
const runDir = resolve(here, ".run");
const apiserver = resolve(here, "../../apiserver");
const env = { ...process.env, MIKRO_CONFIG_FILE: resolve(here, "mikro.e2e.json") };

rmSync(runDir, { recursive: true, force: true });
mkdirSync(runDir, { recursive: true });
generateKeys(resolve(runDir, "keys"));

execFileSync("npx", ["prisma", "migrate", "deploy"], { cwd: apiserver, env, stdio: "inherit" });
execFileSync("node", ["scripts/seed-e2e.mjs"], { cwd: apiserver, env, stdio: "inherit" });
console.log("e2e backend ready");
