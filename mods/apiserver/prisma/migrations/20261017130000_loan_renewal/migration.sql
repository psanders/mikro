-- Loan renewal (#334): RENEWED status (enum is TEXT in SQLite, no DDL), the
-- renewal chain + close timestamp on loans, and an optional loan link on
-- customer documents. Plain ADD COLUMNs (no table rebuild) so the migration
-- is cheap and safe on the production database.

-- AlterTable
ALTER TABLE "loans" ADD COLUMN "closed_at" DATETIME;
ALTER TABLE "loans" ADD COLUMN "renewed_from_loan_id" TEXT REFERENCES "loans" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "customer_documents" ADD COLUMN "loan_id" TEXT REFERENCES "loans" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "loans_renewed_from_loan_id_key" ON "loans"("renewed_from_loan_id");

-- CreateIndex
CREATE INDEX "customer_documents_loan_id_idx" ON "customer_documents"("loan_id");
