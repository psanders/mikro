/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Prisma loads this from the apiserver package. We load the repo-root .env so
 * MIKRO_CONFIG_FILE is set, then read databaseUrl via getDatabaseUrlFromFile (same as rest of app).
 */
import { config as loadDotenv } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "prisma/config";
import { getDatabaseUrlFromFile } from "@mikro/common";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

loadDotenv({ path: resolve(repoRoot, ".env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts"
  },
  datasource: {
    url: getDatabaseUrlFromFile(undefined, repoRoot)
  }
});
