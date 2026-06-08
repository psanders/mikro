-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN "review_note" TEXT;
ALTER TABLE "loan_applications" ADD COLUMN "reviewed_at" DATETIME;
ALTER TABLE "loan_applications" ADD COLUMN "reviewed_by_id" TEXT;
