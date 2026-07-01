-- Customer tags (QCobro integration): hybrid AUTO/MANUAL tags on a customer.
-- See QCOBRO.md for the namespace taxonomy (status:, dpd:, risk:).
CREATE TABLE "customer_tags" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tag" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "set_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_tags_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_tags_customer_id_tag_key" ON "customer_tags"("customer_id", "tag");

-- CreateIndex
CREATE INDEX "customer_tags_tag_idx" ON "customer_tags"("tag");

-- Last-synced QCobro portfolio set per customer, for sync diffing.
ALTER TABLE "customers" ADD COLUMN "last_synced_portfolios" TEXT;
