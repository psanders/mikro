/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Integration test setup utilities.
 * Provides in-memory database and tRPC caller helpers.
 */
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../../src/generated/prisma/client.js";
import { appRouter } from "../../src/trpc/index.js";
import type { Context } from "../../src/trpc/context.js";

/**
 * Schema SQL matching current Prisma schema.
 * This is used to initialize the in-memory SQLite database.
 */
const SCHEMA_SQL = `
-- Users table
CREATE TABLE "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- User roles table
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Members table
CREATE TABLE "members" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "id_number" TEXT NOT NULL,
    "collection_point" TEXT NOT NULL,
    "home_address" TEXT NOT NULL,
    "job_position" TEXT,
    "income" DECIMAL,
    "is_business_owner" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "id_card_on_record" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "created_by_id" TEXT,
    "referred_by_id" TEXT,
    "assigned_collector_id" TEXT,
    CONSTRAINT "members_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "members_referred_by_id_fkey" FOREIGN KEY ("referred_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "members_assigned_collector_id_fkey" FOREIGN KEY ("assigned_collector_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Loans table
CREATE TABLE "loans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loan_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SAN',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "principal" DECIMAL NOT NULL,
    "term_length" INTEGER NOT NULL,
    "payment_amount" DECIMAL NOT NULL,
    "payment_frequency" TEXT NOT NULL,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "member_id" TEXT NOT NULL,
    CONSTRAINT "loans_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Payments table
CREATE TABLE "payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" DECIMAL NOT NULL,
    "paid_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "notes" TEXT,
    "loan_id" TEXT NOT NULL,
    "collected_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "payments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payments_collected_by_id_fkey" FOREIGN KEY ("collected_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Messages table
CREATE TABLE "messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "tools" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "member_id" TEXT,
    "user_id" TEXT,
    CONSTRAINT "messages_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Attachments table
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "name" TEXT,
    "mime_type" TEXT,
    "size" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "message_id" TEXT NOT NULL,
    CONSTRAINT "attachments_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");
CREATE UNIQUE INDEX "user_roles_user_id_role_key" ON "user_roles"("user_id", "role");
CREATE INDEX "members_created_by_id_idx" ON "members"("created_by_id");
CREATE INDEX "members_assigned_collector_id_idx" ON "members"("assigned_collector_id");
CREATE INDEX "members_phone_idx" ON "members"("phone");
CREATE UNIQUE INDEX "loans_loan_id_key" ON "loans"("loan_id");
CREATE INDEX "loans_member_id_idx" ON "loans"("member_id");
CREATE INDEX "loans_status_idx" ON "loans"("status");
CREATE INDEX "payments_loan_id_idx" ON "payments"("loan_id");
CREATE INDEX "payments_collected_by_id_idx" ON "payments"("collected_by_id");
CREATE INDEX "payments_paid_at_idx" ON "payments"("paid_at");
CREATE INDEX "messages_member_id_idx" ON "messages"("member_id");
CREATE INDEX "messages_user_id_idx" ON "messages"("user_id");
CREATE INDEX "messages_created_at_idx" ON "messages"("created_at");
CREATE INDEX "attachments_message_id_idx" ON "attachments"("message_id");
`;

/**
 * Creates an in-memory Prisma client for testing.
 * @returns A new PrismaClient instance connected to in-memory SQLite
 */
export function createTestDb() {
  const adapter = new PrismaBetterSqlite3({ url: ":memory:" });
  return new PrismaClient({ adapter });
}

/**
 * Applies the database schema to an in-memory database.
 * Must be called before running any tests.
 * @param db - The PrismaClient instance
 */
export async function applySchema(db: PrismaClient) {
  // Split statements, handling multi-line and comments properly
  const statements: string[] = [];
  let currentStmt = "";

  for (const line of SCHEMA_SQL.split("\n")) {
    const trimmed = line.trim();
    
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("--")) {
      continue;
    }

    currentStmt += " " + trimmed;

    // If line ends with semicolon, it's a complete statement
    if (trimmed.endsWith(";")) {
      const stmt = currentStmt.trim().slice(0, -1); // Remove trailing semicolon
      if (stmt) {
        statements.push(stmt);
      }
      currentStmt = "";
    }
  }

  // Execute each statement
  for (const stmt of statements) {
    await db.$executeRawUnsafe(stmt);
  }
}

/**
 * Creates an authenticated tRPC caller for testing protected procedures.
 * @param db - The PrismaClient instance to use for database operations
 * @returns A tRPC caller with isAuthenticated: true
 */
export function createAuthenticatedCaller(db: PrismaClient) {
  const ctx: Context = { db: db as any, isAuthenticated: true };
  return appRouter.createCaller(ctx);
}

/**
 * Creates an unauthenticated tRPC caller for testing auth rejection.
 * @param db - The PrismaClient instance to use for database operations
 * @returns A tRPC caller with isAuthenticated: false
 */
export function createUnauthenticatedCaller(db: PrismaClient) {
  const ctx: Context = { db: db as any, isAuthenticated: false };
  return appRouter.createCaller(ctx);
}

/**
 * Type alias for the test database instance.
 */
export type TestDb = ReturnType<typeof createTestDb>;

/**
 * Type alias for the authenticated caller.
 */
export type AuthenticatedCaller = ReturnType<typeof createAuthenticatedCaller>;

/**
 * Type alias for the unauthenticated caller.
 */
export type UnauthenticatedCaller = ReturnType<typeof createUnauthenticatedCaller>;
