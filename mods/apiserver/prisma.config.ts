/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx tsx prisma/seed.ts"
  },
  datasource: {
    url: process.env.MIKRO_DATABASE_URL || "file:./data/dev.db"
  }
});
