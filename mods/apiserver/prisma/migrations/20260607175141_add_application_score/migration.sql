-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN "recommendation" TEXT;
ALTER TABLE "loan_applications" ADD COLUMN "risk_band" TEXT;
ALTER TABLE "loan_applications" ADD COLUMN "score" INTEGER;
ALTER TABLE "loan_applications" ADD COLUMN "score_data" JSONB;
ALTER TABLE "loan_applications" ADD COLUMN "scored_at" DATETIME;
