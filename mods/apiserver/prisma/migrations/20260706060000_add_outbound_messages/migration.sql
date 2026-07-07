-- CreateTable
CREATE TABLE "outbound_messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "wa_message_id" TEXT NOT NULL,
    "feed_event_id" TEXT,
    "phone" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'accepted',
    "error_code" INTEGER,
    "error_title" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "outbound_messages_wa_message_id_key" ON "outbound_messages"("wa_message_id");

-- CreateIndex
CREATE INDEX "outbound_messages_feed_event_id_idx" ON "outbound_messages"("feed_event_id");
