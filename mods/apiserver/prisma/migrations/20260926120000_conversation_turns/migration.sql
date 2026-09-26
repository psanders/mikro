-- CreateTable: persisted WhatsApp CX transcripts (issue #299)
CREATE TABLE "conversation_turns" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "phone" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "profile" TEXT,
    "agent_name" TEXT,
    "agent_version" TEXT,
    "tool_calls" TEXT,
    "has_image" BOOLEAN NOT NULL DEFAULT false,
    "application_id" TEXT,
    "customer_id" TEXT,
    "wa_message_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "conversation_turns_phone_created_at_idx" ON "conversation_turns"("phone", "created_at");
CREATE INDEX "conversation_turns_application_id_idx" ON "conversation_turns"("application_id");
CREATE INDEX "conversation_turns_customer_id_idx" ON "conversation_turns"("customer_id");
CREATE INDEX "conversation_turns_created_at_idx" ON "conversation_turns"("created_at");
