/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * This module is often loaded before index.ts (via trpc/context). Ensure config path
 * is set before getConfig() runs, since ESM resolves imports before the importer's body runs.
 */
import { config as loadDotenv } from "dotenv";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
loadDotenv({ path: resolve(repoRoot, ".env") });
if (!process.env.MIKRO_CONFIG_FILE) {
  process.env.MIKRO_CONFIG_FILE = resolve(repoRoot, "mikro.json");
}

import { getConfig } from "@mikro/common";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./generated/prisma/client.js";

const adapter = new PrismaBetterSqlite3({
  url: getConfig().databaseUrl
});

export const prisma = new PrismaClient({ adapter });
