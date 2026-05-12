-- AlterTable
ALTER TABLE "loans" ADD COLUMN "mora_rate" REAL;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'INSTALLMENT';
ALTER TABLE "payments" ADD COLUMN "linked_payment_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "payments_linked_payment_id_key" ON "payments"("linked_payment_id");

-- CreateIndex
CREATE INDEX "payments_kind_idx" ON "payments"("kind");
