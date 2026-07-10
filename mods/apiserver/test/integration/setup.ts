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
    "collection_point" TEXT,
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
    "channel" TEXT NOT NULL DEFAULT 'whatsapp',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" DATETIME,
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

-- Customer documents table
CREATE TABLE "customer_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT,
    "mime_type" TEXT,
    "size" INTEGER,
    "sha256" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_documents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "customer_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Indexes
CREATE UNIQUE INDEX "customer_tags_customer_id_tag_key" ON "customer_tags"("customer_id", "tag");
CREATE INDEX "customer_tags_tag_idx" ON "customer_tags"("tag");
CREATE INDEX "customer_documents_customer_id_idx" ON "customer_documents"("customer_id");
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

-- Loan applications table (origination pipeline)
CREATE TABLE "loan_applications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "source" TEXT NOT NULL DEFAULT 'FORM',
    "last_section" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "phone" TEXT,
    "id_number" TEXT,
    "date_of_birth" DATETIME,
    "marital_status" TEXT,
    "business_type" TEXT,
    "business_name" TEXT,
    "requested_amount" DECIMAL,
    "purpose" TEXT,
    "requested_term_weeks" INTEGER,
    "province" TEXT,
    "home_address" TEXT,
    "raw_data" JSONB NOT NULL,
    "score_data" JSONB,
    "score" INTEGER,
    "risk_band" TEXT,
    "recommendation" TEXT,
    "scored_at" DATETIME,
    "reviewed_by_id" TEXT,
    "reviewed_at" DATETIME,
    "review_note" TEXT,
    "contract_filename" TEXT,
    "contract_original_name" TEXT,
    "contract_mime_type" TEXT,
    "contract_size" INTEGER,
    "contract_sha256" TEXT,
    "signed_by_id" TEXT,
    "signed_at" DATETIME,
    "id_front_filename" TEXT,
    "id_front_original_name" TEXT,
    "id_front_mime_type" TEXT,
    "id_front_size" INTEGER,
    "id_back_filename" TEXT,
    "id_back_original_name" TEXT,
    "id_back_mime_type" TEXT,
    "id_back_size" INTEGER,
    "id_uploaded_by_id" TEXT,
    "id_uploaded_at" DATETIME,
    "customer_id" TEXT,
    "loan_id" INTEGER,
    "submitted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "loan_applications_session_id_key" ON "loan_applications"("session_id");
CREATE INDEX "loan_applications_status_idx" ON "loan_applications"("status");
CREATE INDEX "loan_applications_session_id_idx" ON "loan_applications"("session_id");

-- Follow-up jobs table
CREATE TABLE "follow_up_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "application_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scheduled_for" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "follow_up_jobs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "follow_up_jobs_status_scheduled_for_idx" ON "follow_up_jobs"("status", "scheduled_for");
CREATE INDEX "follow_up_jobs_application_id_idx" ON "follow_up_jobs"("application_id");

-- Business events table (founder feed, append-only)
CREATE TABLE "business_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "occurred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT,
    "actor_name" TEXT NOT NULL,
    "customer_id" TEXT,
    "customer_name" TEXT,
    "loan_id" TEXT,
    "application_id" TEXT,
    "amount" DECIMAL,
    "summary" TEXT NOT NULL,
    "payload" TEXT NOT NULL
);
CREATE INDEX "business_events_occurred_at_id_idx" ON "business_events"("occurred_at", "id");
CREATE INDEX "business_events_type_idx" ON "business_events"("type");
CREATE INDEX "business_events_customer_id_idx" ON "business_events"("customer_id");

-- Outbound WhatsApp message delivery tracking
CREATE TABLE "outbound_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wa_message_id" TEXT NOT NULL,
    "feed_event_id" TEXT,
    "phone" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'accepted',
    "error_code" INTEGER,
    "error_title" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "outbound_messages_wa_message_id_key" ON "outbound_messages"("wa_message_id");
CREATE INDEX "outbound_messages_feed_event_id_idx" ON "outbound_messages"("feed_event_id");

-- Watch rules (founder copilot)
CREATE TABLE "watch_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "comparator" TEXT NOT NULL,
    "threshold" REAL NOT NULL,
    "collector_id" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "last_state" TEXT,
    "last_evaluated_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
CREATE INDEX "watch_rules_enabled_idx" ON "watch_rules"("enabled");

-- Copilot pending actions (founder copilot)
CREATE TABLE "copilot_pending_actions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "tool_name" TEXT NOT NULL,
    "args_json" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" DATETIME,
    "deleted_at" DATETIME
);
CREATE INDEX "copilot_pending_actions_user_id_status_idx" ON "copilot_pending_actions"("user_id", "status");

-- Accounting module (accounts, categories, transactions)
CREATE TABLE "accounting_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'BANK',
    "currency" TEXT NOT NULL DEFAULT 'DOP',
    "opening_balance" DECIMAL NOT NULL DEFAULT 0,
    "current_balance" DECIMAL NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "accounting_accounts_name_key" ON "accounting_accounts"("name");

CREATE TABLE "accounting_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "accounting_categories_name_key" ON "accounting_categories"("name");

CREATE TABLE "accounting_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "amount" DECIMAL NOT NULL,
    "occurred_at" DATETIME NOT NULL,
    "description" TEXT,
    "vendor" TEXT,
    "reference" TEXT,
    "reversal_of_id" TEXT,
    "account_id" TEXT NOT NULL,
    "to_account_id" TEXT,
    "category_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "accounting_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounting_accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "accounting_transactions_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "accounting_accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "accounting_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "accounting_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "accounting_transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "accounting_transactions_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "accounting_transactions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "accounting_transactions_reversal_of_id_key" ON "accounting_transactions"("reversal_of_id");
CREATE INDEX "accounting_transactions_account_id_occurred_at_idx" ON "accounting_transactions"("account_id", "occurred_at");
CREATE INDEX "accounting_transactions_category_id_idx" ON "accounting_transactions"("category_id");
CREATE INDEX "accounting_transactions_type_idx" ON "accounting_transactions"("type");
CREATE INDEX "accounting_transactions_occurred_at_idx" ON "accounting_transactions"("occurred_at");

CREATE TABLE "accounting_transaction_attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "original_name" TEXT,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transaction_id" TEXT NOT NULL,
    CONSTRAINT "accounting_transaction_attachments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "accounting_transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "accounting_transaction_attachments_transaction_id_idx" ON "accounting_transaction_attachments"("transaction_id");

-- Founder tasks (scheduled automations)
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "automation_id" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "weekday" INTEGER,
    "day_of_month" INTEGER,
    "on_date" TEXT,
    "time_of_day" TEXT NOT NULL,
    "static_params_json" TEXT NOT NULL,
    "gate" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "next_fire_at" DATETIME,
    "created_by_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
CREATE INDEX "tasks_enabled_next_fire_at_idx" ON "tasks"("enabled", "next_fire_at");

CREATE TABLE "task_firings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "task_id" TEXT,
    "automation_id" TEXT NOT NULL,
    "task_name" TEXT NOT NULL,
    "gate" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "payload_json" TEXT NOT NULL,
    "missing_slots_json" TEXT,
    "context_json" TEXT,
    "reason" TEXT,
    "due_at" DATETIME NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" DATETIME,
    "resolved_by_id" TEXT,
    CONSTRAINT "task_firings_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "task_firings_task_id_status_idx" ON "task_firings"("task_id", "status");
CREATE INDEX "task_firings_status_idx" ON "task_firings"("status");
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
