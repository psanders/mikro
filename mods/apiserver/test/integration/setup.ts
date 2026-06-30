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
    "password" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- Unique phone index for login
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- User roles table
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    CONSTRAINT "user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Customers table
CREATE TABLE "customers" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nickname" TEXT,
    "phone" TEXT NOT NULL,
    "id_number" TEXT NOT NULL,
    "collection_point" TEXT NOT NULL,
    "home_address" TEXT NOT NULL,
    "job_position" TEXT,
    "income" DECIMAL,
    "is_business_owner" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "id_card_on_record" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "preferred_payment_day" TEXT,
    "last_synced_portfolios" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "created_by_id" TEXT,
    "referred_by_id" TEXT,
    "assigned_collector_id" TEXT,
    CONSTRAINT "customers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "customers_referred_by_id_fkey" FOREIGN KEY ("referred_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "customers_assigned_collector_id_fkey" FOREIGN KEY ("assigned_collector_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Notification policies table
CREATE TABLE "notification_policies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collections" BOOLEAN NOT NULL DEFAULT true,
    "payment_confirmations" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "customer_id" TEXT NOT NULL,
    CONSTRAINT "notification_policies_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "starting_date" DATETIME,
    "nickname" TEXT,
    "mora_rate" DECIMAL,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "customer_id" TEXT NOT NULL,
    CONSTRAINT "loans_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Payments table
CREATE TABLE "payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" DECIMAL NOT NULL,
    "paid_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "kind" TEXT NOT NULL DEFAULT 'INSTALLMENT',
    "notes" TEXT,
    "linked_payment_id" TEXT UNIQUE,
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
    "customer_id" TEXT,
    "user_id" TEXT,
    CONSTRAINT "messages_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
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

-- Collection attempts table
CREATE TABLE "collection_attempts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channel" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "message_id" TEXT,
    "template_name" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customer_id" TEXT NOT NULL,
    "loan_id" TEXT NOT NULL,
    CONSTRAINT "collection_attempts_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "collection_attempts_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Loan notes table
CREATE TABLE "loan_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loan_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    CONSTRAINT "loan_notes_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "loan_notes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Customer tags table (QCobro integration)
CREATE TABLE "customer_tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tag" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "set_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_tags_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes
CREATE UNIQUE INDEX "customer_tags_customer_id_tag_key" ON "customer_tags"("customer_id", "tag");
CREATE INDEX "customer_tags_tag_idx" ON "customer_tags"("tag");
CREATE INDEX "loan_notes_loan_id_idx" ON "loan_notes"("loan_id");
CREATE INDEX "loan_notes_created_at_idx" ON "loan_notes"("created_at");
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");
CREATE UNIQUE INDEX "user_roles_user_id_role_key" ON "user_roles"("user_id", "role");
CREATE INDEX "customers_created_by_id_idx" ON "customers"("created_by_id");
CREATE INDEX "customers_assigned_collector_id_idx" ON "customers"("assigned_collector_id");
CREATE INDEX "customers_phone_idx" ON "customers"("phone");
CREATE UNIQUE INDEX "notification_policies_customer_id_key" ON "notification_policies"("customer_id");
CREATE UNIQUE INDEX "loans_loan_id_key" ON "loans"("loan_id");
CREATE INDEX "loans_customer_id_idx" ON "loans"("customer_id");
CREATE INDEX "loans_status_idx" ON "loans"("status");
CREATE INDEX "payments_loan_id_idx" ON "payments"("loan_id");
CREATE INDEX "payments_collected_by_id_idx" ON "payments"("collected_by_id");
CREATE INDEX "payments_paid_at_idx" ON "payments"("paid_at");
CREATE INDEX "payments_kind_idx" ON "payments"("kind");
CREATE INDEX "messages_customer_id_idx" ON "messages"("customer_id");
CREATE INDEX "messages_user_id_idx" ON "messages"("user_id");
CREATE INDEX "messages_created_at_idx" ON "messages"("created_at");
CREATE INDEX "attachments_message_id_idx" ON "attachments"("message_id");
CREATE INDEX "collection_attempts_customer_id_idx" ON "collection_attempts"("customer_id");
CREATE INDEX "collection_attempts_loan_id_idx" ON "collection_attempts"("loan_id");
CREATE INDEX "collection_attempts_created_at_idx" ON "collection_attempts"("created_at");
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
  const ctx: Context = {
    db: db as any,
    isAuthenticated: true,
    userId: "00000000-0000-4000-8000-000000000001",
    roles: ["ADMIN"]
  };
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
