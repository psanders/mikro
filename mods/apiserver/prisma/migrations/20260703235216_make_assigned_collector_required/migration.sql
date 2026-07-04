/*
  Warnings:

  - Made the column `assigned_collector_id` on table `customers` required. This step will fail if there are existing NULL values in that column.

*/
-- Backfill: dev-data-only default collector for rows with no assignment (mikro/#41).
UPDATE "customers" SET "assigned_collector_id" = '22222222-2222-4222-a222-222222222221' WHERE "assigned_collector_id" IS NULL;
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_customers" (
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
    "assigned_collector_id" TEXT NOT NULL,
    CONSTRAINT "customers_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "customers_assigned_collector_id_fkey" FOREIGN KEY ("assigned_collector_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_customers" ("assigned_collector_id", "collection_point", "created_at", "created_by_id", "home_address", "id", "id_card_on_record", "id_number", "income", "is_active", "is_business_owner", "job_position", "last_synced_portfolios", "name", "nickname", "notes", "phone", "preferred_payment_day", "updated_at") SELECT "assigned_collector_id", "collection_point", "created_at", "created_by_id", "home_address", "id", "id_card_on_record", "id_number", "income", "is_active", "is_business_owner", "job_position", "last_synced_portfolios", "name", "nickname", "notes", "phone", "preferred_payment_day", "updated_at" FROM "customers";
DROP TABLE "customers";
ALTER TABLE "new_customers" RENAME TO "customers";
CREATE INDEX "customers_created_by_id_idx" ON "customers"("created_by_id");
CREATE INDEX "customers_assigned_collector_id_idx" ON "customers"("assigned_collector_id");
CREATE INDEX "customers_phone_idx" ON "customers"("phone");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
