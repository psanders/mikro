-- CreateTable
CREATE TABLE "business_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "occurred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT,
    "actor_name" TEXT NOT NULL,
    "customer_id" TEXT,
    "customer_name" TEXT,
    "loan_id" TEXT,
    "application_id" TEXT,
    "amount" DECIMAL,
    "summary" TEXT NOT NULL,
    "payload" TEXT NOT NULL
);

-- CreateIndex
CREATE INDEX "business_events_occurred_at_id_idx" ON "business_events"("occurred_at", "id");

-- CreateIndex
CREATE INDEX "business_events_type_idx" ON "business_events"("type");

-- CreateIndex
CREATE INDEX "business_events_customer_id_idx" ON "business_events"("customer_id");
