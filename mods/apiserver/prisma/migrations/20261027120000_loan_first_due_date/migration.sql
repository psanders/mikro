-- First cuota due date of a loan (mikro/#385). Nullable, no backfill: loans
-- created before this column keep deriving their first cuota from
-- starting_date (legacy anchor + 1 period).

-- AlterTable
ALTER TABLE "loans" ADD COLUMN "first_due_date" DATETIME;
