/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Prisma loads this from the apiserver package. We load the repo-root .env so
 * MIKRO_CONFIG_FILE is set, then resolve databaseUrl from the config file.
 *
 * The URL resolution is inlined here (mirrors `getDatabaseUrlFromFile` in
 * @mikro/common) on purpose: importing the `@mikro/common` barrel pulls in the
 * receipt/report stack and its native `@resvg/resvg-js` binding, which
 * `prisma generate` does not need — and which breaks CI when the platform
 * binary isn't installed. Keep this file dependency-free beyond node + prisma.
 */
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { config as loadDotenv } from "dotenv";
import { defineConfig } from "prisma/config";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

loadDotenv({ path: resolve(repoRoot, ".env") });

/** Runtime/Docker default; mirrors @mikro/common's DEFAULT_DATABASE_URL. */
const DEFAULT_DATABASE_URL = "file:/app/data/mikro.db";

/**
 * Normalize a `file:` URL to an absolute path, resolving a relative path against
 * the config-file directory (mirrors @mikro/common's resolveDatabaseUrl). Keeps
 * `migrate deploy`/seed pointed at the SAME db the server opens at runtime,
 * regardless of the working directory Prisma is invoked from.
 */
function resolveFileUrl(url: string, configFilePath: string): string {
  const FILE_PREFIX = "file:";
  if (!url.startsWith(FILE_PREFIX)) return url;
  const p = url.slice(FILE_PREFIX.length);
  if (p.startsWith(":") || resolve(p) === p) return url; // in-memory or already absolute
  return `${FILE_PREFIX}${resolve(dirname(configFilePath), p)}`;
}

function databaseUrl(): string {
  const filePath = resolve(repoRoot, process.env.MIKRO_CONFIG_FILE ?? "mikro.json");
  if (!existsSync(filePath)) return DEFAULT_DATABASE_URL;
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf-8")) as { databaseUrl?: unknown };
    if (typeof raw.databaseUrl === "string" && raw.databaseUrl.trim()) {
      return resolveFileUrl(raw.databaseUrl, filePath);
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_DATABASE_URL;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts"
  },
  datasource: {
    url: databaseUrl()
  }
});
