-- CreateTable
CREATE TABLE "notification_policies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "collections" BOOLEAN NOT NULL DEFAULT true,
    "payment_confirmations" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "customer_id" TEXT NOT NULL,
    CONSTRAINT "notification_policies_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_policies_customer_id_key" ON "notification_policies"("customer_id");
