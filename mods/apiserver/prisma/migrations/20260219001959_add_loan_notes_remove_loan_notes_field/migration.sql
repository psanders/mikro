/*
  Warnings:

  - You are about to drop the column `notes` on the `loans` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "loan_notes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "content" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "loan_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    CONSTRAINT "loan_notes_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "loan_notes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_loans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loan_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SAN',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "principal" DECIMAL NOT NULL,
    "term_length" INTEGER NOT NULL,
    "payment_amount" DECIMAL NOT NULL,
    "payment_frequency" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "customer_id" TEXT NOT NULL,
    CONSTRAINT "loans_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_loans" ("created_at", "customer_id", "id", "loan_id", "payment_amount", "payment_frequency", "principal", "status", "term_length", "type", "updated_at") SELECT "created_at", "customer_id", "id", "loan_id", "payment_amount", "payment_frequency", "principal", "status", "term_length", "type", "updated_at" FROM "loans";
DROP TABLE "loans";
ALTER TABLE "new_loans" RENAME TO "loans";
CREATE UNIQUE INDEX "loans_loan_id_key" ON "loans"("loan_id");
CREATE INDEX "loans_customer_id_idx" ON "loans"("customer_id");
CREATE INDEX "loans_status_idx" ON "loans"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "loan_notes_loan_id_idx" ON "loan_notes"("loan_id");

-- CreateIndex
CREATE INDEX "loan_notes_created_at_idx" ON "loan_notes"("created_at");
