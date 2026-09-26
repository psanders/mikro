-- AlterTable: WhatsApp business-scoped user ids (usernames), internal matching only
ALTER TABLE "customers" ADD COLUMN "whatsapp_user_id" TEXT;
ALTER TABLE "customers" ADD COLUMN "whatsapp_username" TEXT;
ALTER TABLE "loan_applications" ADD COLUMN "whatsapp_user_id" TEXT;
ALTER TABLE "loan_applications" ADD COLUMN "whatsapp_username" TEXT;
ALTER TABLE "conversation_handoffs" ADD COLUMN "whatsapp_user_id" TEXT;

-- CreateIndex
CREATE INDEX "customers_whatsapp_user_id_idx" ON "customers"("whatsapp_user_id");
CREATE INDEX "loan_applications_whatsapp_user_id_idx" ON "loan_applications"("whatsapp_user_id");
CREATE INDEX "conversation_handoffs_whatsapp_user_id_closed_at_idx" ON "conversation_handoffs"("whatsapp_user_id", "closed_at");
