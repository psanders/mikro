-- AlterTable: which ad produced each applicant (null for organic/direct)
ALTER TABLE "loan_applications" ADD COLUMN "ad_id" TEXT;
ALTER TABLE "loan_applications" ADD COLUMN "adset_id" TEXT;
ALTER TABLE "loan_applications" ADD COLUMN "campaign_id" TEXT;

-- CreateIndex
CREATE INDEX "loan_applications_ad_id_idx" ON "loan_applications"("ad_id");

-- CreateTable: local ad-name catalog, learned from the forwarded URL parameters
CREATE TABLE "meta_ads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "adset_id" TEXT,
    "adset_name" TEXT,
    "campaign_id" TEXT,
    "campaign_name" TEXT,
    "first_seen_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" DATETIME NOT NULL
);
