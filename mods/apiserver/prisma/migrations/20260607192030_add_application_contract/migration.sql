-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN "contract_filename" TEXT;
ALTER TABLE "loan_applications" ADD COLUMN "contract_mime_type" TEXT;
ALTER TABLE "loan_applications" ADD COLUMN "contract_original_name" TEXT;
ALTER TABLE "loan_applications" ADD COLUMN "contract_sha256" TEXT;
ALTER TABLE "loan_applications" ADD COLUMN "contract_size" INTEGER;
ALTER TABLE "loan_applications" ADD COLUMN "signed_at" DATETIME;
ALTER TABLE "loan_applications" ADD COLUMN "signed_by_id" TEXT;
