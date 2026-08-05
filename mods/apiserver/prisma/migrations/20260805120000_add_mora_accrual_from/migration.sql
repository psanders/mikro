-- Accrual start a LATE_FEE row's mora was computed from, frozen at charge time.
-- Nullable: rows written before anchoring existed fall back to the loan's
-- current oldest missed due date, so no historical charge is restated.
ALTER TABLE "payments" ADD COLUMN "mora_accrual_from" DATETIME;
