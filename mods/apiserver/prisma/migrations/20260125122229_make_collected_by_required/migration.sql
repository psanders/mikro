/*
  Warnings:

  - Made the column `collected_by_id` on table `payments` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" DECIMAL NOT NULL,
    "paid_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "notes" TEXT,
    "loan_id" TEXT NOT NULL,
    "collected_by_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "payments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payments_collected_by_id_fkey" FOREIGN KEY ("collected_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_payments" ("amount", "collected_by_id", "created_at", "id", "loan_id", "method", "notes", "paid_at", "status", "updated_at") SELECT "amount", "collected_by_id", "created_at", "id", "loan_id", "method", "notes", "paid_at", "status", "updated_at" FROM "payments";
DROP TABLE "payments";
ALTER TABLE "new_payments" RENAME TO "payments";
CREATE INDEX "payments_loan_id_idx" ON "payments"("loan_id");
CREATE INDEX "payments_collected_by_id_idx" ON "payments"("collected_by_id");
CREATE INDEX "payments_paid_at_idx" ON "payments"("paid_at");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
