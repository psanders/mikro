-- Disable foreign keys so we can drop and recreate tables that are referenced
PRAGMA foreign_keys=OFF;

-- Rename members table to customers
ALTER TABLE "members" RENAME TO "customers";

-- Recreate loans with customer_id and FK to customers (SQLite does not update FK refs on table rename)
CREATE TABLE "loans_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loan_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SAN',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "principal" DECIMAL NOT NULL,
    "term_length" INTEGER NOT NULL,
    "payment_amount" DECIMAL NOT NULL,
    "payment_frequency" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "customer_id" TEXT NOT NULL,
    CONSTRAINT "loans_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "loans_new" ("id", "loan_id", "type", "status", "principal", "term_length", "payment_amount", "payment_frequency", "notes", "created_at", "updated_at", "customer_id")
SELECT "id", "loan_id", "type", "status", "principal", "term_length", "payment_amount", "payment_frequency", "notes", "created_at", "updated_at", "member_id" FROM "loans";

DROP TABLE "loans";
ALTER TABLE "loans_new" RENAME TO "loans";

-- Recreate messages with customer_id and FK to customers
CREATE TABLE "messages_new" (
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

INSERT INTO "messages_new" ("id", "role", "content", "tools", "created_at", "customer_id", "user_id")
SELECT "id", "role", "content", "tools", "created_at", "member_id", "user_id" FROM "messages";

DROP TABLE "messages";
ALTER TABLE "messages_new" RENAME TO "messages";

-- Recreate collection_attempts with customer_id and FK to customers
CREATE TABLE "collection_attempts_new" (
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

INSERT INTO "collection_attempts_new" ("id", "channel", "type", "status", "message_id", "template_name", "notes", "created_at", "customer_id", "loan_id")
SELECT "id", "channel", "type", "status", "message_id", "template_name", "notes", "created_at", "member_id", "loan_id" FROM "collection_attempts";

DROP TABLE "collection_attempts";
ALTER TABLE "collection_attempts_new" RENAME TO "collection_attempts";

-- Drop old indexes and recreate with new names
DROP INDEX IF EXISTS "members_created_by_id_idx";
DROP INDEX IF EXISTS "members_assigned_collector_id_idx";
DROP INDEX IF EXISTS "members_phone_idx";
DROP INDEX IF EXISTS "loans_member_id_idx";
DROP INDEX IF EXISTS "messages_member_id_idx";
DROP INDEX IF EXISTS "collection_attempts_member_id_idx";

CREATE INDEX "customers_created_by_id_idx" ON "customers"("created_by_id");
CREATE INDEX "customers_assigned_collector_id_idx" ON "customers"("assigned_collector_id");
CREATE INDEX "customers_phone_idx" ON "customers"("phone");
CREATE UNIQUE INDEX "loans_loan_id_key" ON "loans"("loan_id");
CREATE INDEX "loans_customer_id_idx" ON "loans"("customer_id");
CREATE INDEX "loans_status_idx" ON "loans"("status");
CREATE INDEX "messages_customer_id_idx" ON "messages"("customer_id");
CREATE INDEX "messages_user_id_idx" ON "messages"("user_id");
CREATE INDEX "messages_created_at_idx" ON "messages"("created_at");
CREATE INDEX "collection_attempts_customer_id_idx" ON "collection_attempts"("customer_id");
CREATE INDEX "collection_attempts_loan_id_idx" ON "collection_attempts"("loan_id");
CREATE INDEX "collection_attempts_created_at_idx" ON "collection_attempts"("created_at");

PRAGMA foreign_keys=ON;
