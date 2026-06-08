-- CreateTable
CREATE TABLE "loan_applications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
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
    "customer_id" TEXT,
    "loan_id" INTEGER,
    "submitted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "loan_applications_session_id_key" ON "loan_applications"("session_id");

-- CreateIndex
CREATE INDEX "loan_applications_status_idx" ON "loan_applications"("status");

-- CreateIndex
CREATE INDEX "loan_applications_session_id_idx" ON "loan_applications"("session_id");
