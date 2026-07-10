-- CreateTable
CREATE TABLE "customer_documents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "original_name" TEXT,
    "mime_type" TEXT,
    "size" INTEGER,
    "sha256" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "customer_documents_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "customer_documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "customer_documents_customer_id_idx" ON "customer_documents"("customer_id");
