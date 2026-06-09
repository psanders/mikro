-- AlterTable
ALTER TABLE "loan_applications" ADD COLUMN "id_front_filename" TEXT;
ALTER TABLE "loan_applications" ADD COLUMN "id_front_original_name" TEXT;
ALTER TABLE "loan_applications" ADD COLUMN "id_front_mime_type" TEXT;
ALTER TABLE "loan_applications" ADD COLUMN "id_front_size" INTEGER;
ALTER TABLE "loan_applications" ADD COLUMN "id_back_filename" TEXT;
ALTER TABLE "loan_applications" ADD COLUMN "id_back_original_name" TEXT;
ALTER TABLE "loan_applications" ADD COLUMN "id_back_mime_type" TEXT;
ALTER TABLE "loan_applications" ADD COLUMN "id_back_size" INTEGER;
ALTER TABLE "loan_applications" ADD COLUMN "id_uploaded_by_id" TEXT;
ALTER TABLE "loan_applications" ADD COLUMN "id_uploaded_at" DATETIME;
