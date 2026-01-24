-- AlterTable: Change is_active default from true to false
-- SQLite doesn't support ALTER TABLE to change defaults, so we need to recreate the table

-- Create new table with correct default
CREATE TABLE "members_new" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "id_number" TEXT NOT NULL,
    "collection_point" TEXT NOT NULL,
    "home_address" TEXT NOT NULL,
    "job_position" TEXT,
    "income" DECIMAL,
    "is_business_owner" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "id_card_on_record" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "created_by_id" TEXT,
    "referred_by_id" TEXT,
    "assigned_collector_id" TEXT,
    CONSTRAINT "members_new_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "members_new_referred_by_id_fkey" FOREIGN KEY ("referred_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "members_new_assigned_collector_id_fkey" FOREIGN KEY ("assigned_collector_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Copy data from old table to new table
-- Preserve existing is_active values (only the default for new records changes)
INSERT INTO "members_new" (
    "id", "name", "phone", "id_number", "collection_point", "home_address",
    "job_position", "income", "is_business_owner", "is_active", "id_card_on_record",
    "created_at", "updated_at", "created_by_id", "referred_by_id", "assigned_collector_id"
)
SELECT 
    "id", "name", "phone", "id_number", "collection_point", "home_address",
    "job_position", "income", 
    COALESCE("is_business_owner", false) as "is_business_owner",
    COALESCE("is_active", false) as "is_active",  -- Preserve existing values, default to false if missing
    COALESCE("id_card_on_record", false) as "id_card_on_record",
    "created_at", "updated_at", "created_by_id", "referred_by_id", "assigned_collector_id"
FROM "members";

-- Drop old table
DROP TABLE "members";

-- Rename new table to original name
ALTER TABLE "members_new" RENAME TO "members";

-- Recreate indexes
CREATE INDEX "members_created_by_id_idx" ON "members"("created_by_id");
CREATE INDEX "members_assigned_collector_id_idx" ON "members"("assigned_collector_id");
CREATE INDEX "members_phone_idx" ON "members"("phone");
