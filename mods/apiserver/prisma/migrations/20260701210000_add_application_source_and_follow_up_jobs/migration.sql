-- CreateTable
CREATE TABLE "follow_up_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "application_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scheduled_for" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "follow_up_jobs_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_loan_applications" (
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
INSERT INTO "new_loan_applications" ("business_name", "business_type", "contract_filename", "contract_mime_type", "contract_original_name", "contract_sha256", "contract_size", "created_at", "customer_id", "date_of_birth", "first_name", "home_address", "id", "id_back_filename", "id_back_mime_type", "id_back_original_name", "id_back_size", "id_front_filename", "id_front_mime_type", "id_front_original_name", "id_front_size", "id_number", "id_uploaded_at", "id_uploaded_by_id", "last_name", "last_section", "loan_id", "marital_status", "phone", "province", "purpose", "raw_data", "recommendation", "requested_amount", "requested_term_weeks", "review_note", "reviewed_at", "reviewed_by_id", "risk_band", "score", "score_data", "scored_at", "session_id", "signed_at", "signed_by_id", "status", "submitted_at", "updated_at") SELECT "business_name", "business_type", "contract_filename", "contract_mime_type", "contract_original_name", "contract_sha256", "contract_size", "created_at", "customer_id", "date_of_birth", "first_name", "home_address", "id", "id_back_filename", "id_back_mime_type", "id_back_original_name", "id_back_size", "id_front_filename", "id_front_mime_type", "id_front_original_name", "id_front_size", "id_number", "id_uploaded_at", "id_uploaded_by_id", "last_name", "last_section", "loan_id", "marital_status", "phone", "province", "purpose", "raw_data", "recommendation", "requested_amount", "requested_term_weeks", "review_note", "reviewed_at", "reviewed_by_id", "risk_band", "score", "score_data", "scored_at", "session_id", "signed_at", "signed_by_id", "status", "submitted_at", "updated_at" FROM "loan_applications";
DROP TABLE "loan_applications";
ALTER TABLE "new_loan_applications" RENAME TO "loan_applications";
CREATE UNIQUE INDEX "loan_applications_session_id_key" ON "loan_applications"("session_id");
CREATE INDEX "loan_applications_status_idx" ON "loan_applications"("status");
CREATE INDEX "loan_applications_session_id_idx" ON "loan_applications"("session_id");
CREATE TABLE "new_loans" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "loan_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'SAN',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "principal" DECIMAL NOT NULL,
    "term_length" INTEGER NOT NULL,
    "payment_amount" DECIMAL NOT NULL,
    "payment_frequency" TEXT NOT NULL,
    "mora_rate" DECIMAL,
    "starting_date" DATETIME,
    "nickname" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "customer_id" TEXT NOT NULL,
    CONSTRAINT "loans_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_loans" ("created_at", "customer_id", "id", "loan_id", "mora_rate", "nickname", "payment_amount", "payment_frequency", "principal", "starting_date", "status", "term_length", "type", "updated_at") SELECT "created_at", "customer_id", "id", "loan_id", "mora_rate", "nickname", "payment_amount", "payment_frequency", "principal", "starting_date", "status", "term_length", "type", "updated_at" FROM "loans";
DROP TABLE "loans";
ALTER TABLE "new_loans" RENAME TO "loans";
CREATE UNIQUE INDEX "loans_loan_id_key" ON "loans"("loan_id");
CREATE INDEX "loans_customer_id_idx" ON "loans"("customer_id");
CREATE INDEX "loans_status_idx" ON "loans"("status");
CREATE TABLE "new_payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "amount" DECIMAL NOT NULL,
    "paid_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL DEFAULT 'CASH',
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "kind" TEXT NOT NULL DEFAULT 'INSTALLMENT',
    "notes" TEXT,
    "linked_payment_id" TEXT,
    "loan_id" TEXT NOT NULL,
    "collected_by_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "payments_linked_payment_id_fkey" FOREIGN KEY ("linked_payment_id") REFERENCES "payments" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "payments_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payments_collected_by_id_fkey" FOREIGN KEY ("collected_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_payments" ("amount", "collected_by_id", "created_at", "id", "kind", "linked_payment_id", "loan_id", "method", "notes", "paid_at", "status", "updated_at") SELECT "amount", "collected_by_id", "created_at", "id", "kind", "linked_payment_id", "loan_id", "method", "notes", "paid_at", "status", "updated_at" FROM "payments";
DROP TABLE "payments";
ALTER TABLE "new_payments" RENAME TO "payments";
CREATE UNIQUE INDEX "payments_linked_payment_id_key" ON "payments"("linked_payment_id");
CREATE INDEX "payments_loan_id_idx" ON "payments"("loan_id");
CREATE INDEX "payments_collected_by_id_idx" ON "payments"("collected_by_id");
CREATE INDEX "payments_paid_at_idx" ON "payments"("paid_at");
CREATE INDEX "payments_kind_idx" ON "payments"("kind");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "follow_up_jobs_status_scheduled_for_idx" ON "follow_up_jobs"("status", "scheduled_for");

-- CreateIndex
CREATE INDEX "follow_up_jobs_application_id_idx" ON "follow_up_jobs"("application_id");

