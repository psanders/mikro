-- Collector evidence (openspec add-collector-evidence): the business location
-- is stored only as a Google Maps link. Additive: nullable columns, no data move.
ALTER TABLE "loan_applications" ADD COLUMN "map_url" TEXT;
-- Claimed by the write that completes the evidence (one completion event each time).
ALTER TABLE "loan_applications" ADD COLUMN "evidence_completed_at" DATETIME;
ALTER TABLE "customers" ADD COLUMN "map_url" TEXT;
