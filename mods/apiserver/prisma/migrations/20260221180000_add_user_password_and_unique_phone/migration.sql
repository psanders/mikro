-- AlterTable
ALTER TABLE "users" ADD COLUMN "password" TEXT;

-- Deduplicate phones before adding unique constraint (no-op if already unique)
UPDATE "users"
SET "phone" = "phone" || '_' || "id"
WHERE "id" IN (
  SELECT u."id" FROM "users" u
  INNER JOIN (SELECT "phone", MIN("id") AS keep_id FROM "users" GROUP BY "phone") g
  ON u."phone" = g."phone" AND u."id" != g.keep_id
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");
