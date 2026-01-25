/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "./generated/prisma/client.js";

const adapter = new PrismaBetterSqlite3({
  url: process.env.MIKRO_DATABASE_URL || "file:./data/dev.db"
});

export const prisma = new PrismaClient({ adapter });
