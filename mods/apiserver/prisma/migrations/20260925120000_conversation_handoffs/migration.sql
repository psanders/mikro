-- CreateTable: WhatsApp conversations handed off to a human (cx-role-based-agents)
CREATE TABLE "conversation_handoffs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "profile" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "application_id" TEXT,
    "customer_id" TEXT,
    "opened_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" DATETIME NOT NULL,
    "closed_at" DATETIME
);
CREATE INDEX "conversation_handoffs_phone_closed_at_idx" ON "conversation_handoffs"("phone", "closed_at");
