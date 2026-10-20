-- Loan renewal as a process (openspec add-loan-renewal): a LoanRenewal row
-- holds the proposed terms, contract and status until finalize; documents can
-- belong to an open renewal. `open_key` (= loan_id while open, NULL after) is
-- unique so a loan has at most one open renewal. Hand-written (a plain CREATE
-- TABLE + ADD COLUMN) to avoid Prisma's table-rebuild diff on SQLite.

-- CreateTable
CREATE TABLE "loan_renewals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "loan_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "principal" DECIMAL NOT NULL,
    "term_length" INTEGER NOT NULL,
    "payment_amount" DECIMAL NOT NULL,
    "payment_frequency" TEXT NOT NULL,
    "starting_date" DATETIME,
    "nickname" TEXT,
    "mora_rate" DECIMAL,
    "quoted_owed" DECIMAL,
    "quoted_net" DECIMAL,
    "quoted_at" DATETIME,
    "contract_filename" TEXT,
    "contract_generated_at" DATETIME,
    "signed_contract_filename" TEXT,
    "new_loan_id" TEXT,
    "ledger_transaction_id" TEXT,
    "completed_at" DATETIME,
    "cancelled_at" DATETIME,
    "cancel_reason" TEXT,
    "open_key" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "loan_renewals_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "loan_renewals_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "loan_renewals_new_loan_id_fkey" FOREIGN KEY ("new_loan_id") REFERENCES "loans" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "loan_renewals_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "customer_documents" ADD COLUMN "renewal_id" TEXT REFERENCES "loan_renewals" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "loan_renewals_new_loan_id_key" ON "loan_renewals"("new_loan_id");

-- CreateIndex
CREATE UNIQUE INDEX "loan_renewals_open_key_key" ON "loan_renewals"("open_key");

-- CreateIndex
CREATE INDEX "loan_renewals_loan_id_idx" ON "loan_renewals"("loan_id");

-- CreateIndex
CREATE INDEX "loan_renewals_customer_id_idx" ON "loan_renewals"("customer_id");

-- CreateIndex
CREATE INDEX "loan_renewals_status_idx" ON "loan_renewals"("status");

-- CreateIndex
CREATE INDEX "customer_documents_renewal_id_idx" ON "customer_documents"("renewal_id");
