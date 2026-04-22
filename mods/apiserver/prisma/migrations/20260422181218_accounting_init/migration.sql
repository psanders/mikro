-- CreateTable
CREATE TABLE "accounting_accounts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'BANK',
    "currency" TEXT NOT NULL DEFAULT 'DOP',
    "opening_balance" DECIMAL NOT NULL DEFAULT 0,
    "current_balance" DECIMAL NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "accounting_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "accounting_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "amount" DECIMAL NOT NULL,
    "occurred_at" DATETIME NOT NULL,
    "description" TEXT,
    "vendor" TEXT,
    "reference" TEXT,
    "reversal_of_id" TEXT,
    "account_id" TEXT NOT NULL,
    "to_account_id" TEXT,
    "category_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "accounting_transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounting_accounts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "accounting_transactions_to_account_id_fkey" FOREIGN KEY ("to_account_id") REFERENCES "accounting_accounts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "accounting_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "accounting_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "accounting_transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "accounting_transactions_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "accounting_transactions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "accounting_transaction_attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "original_name" TEXT,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transaction_id" TEXT NOT NULL,
    CONSTRAINT "accounting_transaction_attachments_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "accounting_transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "accounting_accounts_name_key" ON "accounting_accounts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_categories_name_key" ON "accounting_categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_transactions_reversal_of_id_key" ON "accounting_transactions"("reversal_of_id");

-- CreateIndex
CREATE INDEX "accounting_transactions_account_id_occurred_at_idx" ON "accounting_transactions"("account_id", "occurred_at");

-- CreateIndex
CREATE INDEX "accounting_transactions_category_id_idx" ON "accounting_transactions"("category_id");

-- CreateIndex
CREATE INDEX "accounting_transactions_type_idx" ON "accounting_transactions"("type");

-- CreateIndex
CREATE INDEX "accounting_transactions_occurred_at_idx" ON "accounting_transactions"("occurred_at");

-- CreateIndex
CREATE INDEX "accounting_transaction_attachments_transaction_id_idx" ON "accounting_transaction_attachments"("transaction_id");
