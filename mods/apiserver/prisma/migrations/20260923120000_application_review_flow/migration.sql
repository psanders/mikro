-- Application review flow (openspec add-application-review-flow, design D2/D3).
--
-- ApplicationStatus: SIGNED is removed (rows become APPROVED; their contract
-- columns are kept, which is what conversion now requires) and PENDING_DECISION
-- is added. The overloaded review audit columns (reviewed_by_id / reviewed_at /
-- review_note) are split into assignment and decision columns; the data moves
-- happen inside the table rebuild's INSERT ... SELECT below:
--   * assigned_reviewer_id  <- reviewed_by_id for any row a reviewer touched
--   * decided_*             <- reviewed_* for decided rows
--   * rejection_reason      <- OUT_OF_COVERAGE_AREA for intake auto-rejects, else OTHER
--                              (their free text stays in decision_note)
--   * approved_amount/term  <- the loan's principal for CONVERTED rows, else the
--                              requested terms (the implicit approval of the old flow)
-- Not reversible (columns are dropped): back up with VACUUM INTO before deploying.

-- CreateTable
CREATE TABLE "application_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "application_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT,
    "filename" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "application_documents_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "loan_applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
    "assigned_reviewer_id" TEXT,
    "assigned_at" DATETIME,
    "reviewer_recommendation" TEXT,
    "sent_to_decision_at" DATETIME,
    "decided_by_id" TEXT,
    "decided_at" DATETIME,
    "decision_note" TEXT,
    "rejection_reason" TEXT,
    "approved_amount" DECIMAL,
    "approved_term_weeks" INTEGER,
    "contract_terms" JSONB,
    "ai_summary" TEXT,
    "ai_summary_at" DATETIME,
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
    "ad_id" TEXT,
    "adset_id" TEXT,
    "campaign_id" TEXT,
    "customer_id" TEXT,
    "loan_id" INTEGER,
    "submitted_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_loan_applications" ("ad_id", "adset_id", "business_name", "business_type", "campaign_id", "contract_filename", "contract_mime_type", "contract_original_name", "contract_sha256", "contract_size", "created_at", "customer_id", "date_of_birth", "first_name", "home_address", "id", "id_back_filename", "id_back_mime_type", "id_back_original_name", "id_back_size", "id_front_filename", "id_front_mime_type", "id_front_original_name", "id_front_size", "id_number", "id_uploaded_at", "id_uploaded_by_id", "last_name", "last_section", "loan_id", "marital_status", "phone", "province", "purpose", "raw_data", "recommendation", "requested_amount", "requested_term_weeks", "risk_band", "score", "score_data", "scored_at", "session_id", "signed_at", "signed_by_id", "source", "status", "submitted_at", "updated_at", "assigned_reviewer_id", "assigned_at", "decided_by_id", "decided_at", "decision_note", "rejection_reason", "approved_amount", "approved_term_weeks") SELECT "ad_id", "adset_id", "business_name", "business_type", "campaign_id", "contract_filename", "contract_mime_type", "contract_original_name", "contract_sha256", "contract_size", "created_at", "customer_id", "date_of_birth", "first_name", "home_address", "id", "id_back_filename", "id_back_mime_type", "id_back_original_name", "id_back_size", "id_front_filename", "id_front_mime_type", "id_front_original_name", "id_front_size", "id_number", "id_uploaded_at", "id_uploaded_by_id", "last_name", "last_section", "loan_id", "marital_status", "phone", "province", "purpose", "raw_data", "recommendation", "requested_amount", "requested_term_weeks", "risk_band", "score", "score_data", "scored_at", "session_id", "signed_at", "signed_by_id", "source", CASE WHEN "status" = 'SIGNED' THEN 'APPROVED' ELSE "status" END, "submitted_at", "updated_at",
    CASE WHEN "status" IN ('IN_REVIEW', 'APPROVED', 'SIGNED', 'CONVERTED', 'REJECTED') THEN "reviewed_by_id" END,
    CASE WHEN "status" = 'IN_REVIEW' THEN "reviewed_at" END,
    CASE WHEN "status" IN ('APPROVED', 'SIGNED', 'CONVERTED', 'REJECTED') THEN "reviewed_by_id" END,
    CASE WHEN "status" IN ('APPROVED', 'SIGNED', 'CONVERTED', 'REJECTED') THEN "reviewed_at" END,
    CASE WHEN "status" IN ('APPROVED', 'SIGNED', 'CONVERTED', 'REJECTED') AND NOT ("status" = 'REJECTED' AND "review_note" = 'OUT_OF_COVERAGE_AREA') THEN "review_note" END,
    CASE WHEN "status" = 'REJECTED' AND "review_note" = 'OUT_OF_COVERAGE_AREA' THEN 'OUT_OF_COVERAGE_AREA'
         WHEN "status" = 'REJECTED' THEN 'OTHER' END,
    CASE WHEN "status" = 'CONVERTED' THEN COALESCE((SELECT l."principal" FROM "loans" l WHERE l."loan_id" = "loan_applications"."loan_id"), "requested_amount")
         WHEN "status" IN ('APPROVED', 'SIGNED') THEN "requested_amount" END,
    CASE WHEN "status" IN ('APPROVED', 'SIGNED', 'CONVERTED') THEN "requested_term_weeks" END
FROM "loan_applications";
DROP TABLE "loan_applications";
ALTER TABLE "new_loan_applications" RENAME TO "loan_applications";
CREATE UNIQUE INDEX "loan_applications_session_id_key" ON "loan_applications"("session_id");
CREATE INDEX "loan_applications_status_idx" ON "loan_applications"("status");
CREATE INDEX "loan_applications_session_id_idx" ON "loan_applications"("session_id");
CREATE INDEX "loan_applications_ad_id_idx" ON "loan_applications"("ad_id");
CREATE INDEX "loan_applications_assigned_reviewer_id_idx" ON "loan_applications"("assigned_reviewer_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "application_documents_application_id_idx" ON "application_documents"("application_id");

