-- AlterTable
ALTER TABLE "members" ADD COLUMN "preferred_payment_day" TEXT;

-- CreateTable
CREATE TABLE "collection_attempts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "channel" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "message_id" TEXT,
    "template_name" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "member_id" TEXT NOT NULL,
    "loan_id" TEXT NOT NULL,
    CONSTRAINT "collection_attempts_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "members" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "collection_attempts_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "collection_attempts_member_id_idx" ON "collection_attempts"("member_id");

-- CreateIndex
CREATE INDEX "collection_attempts_loan_id_idx" ON "collection_attempts"("loan_id");

-- CreateIndex
CREATE INDEX "collection_attempts_created_at_idx" ON "collection_attempts"("created_at");
