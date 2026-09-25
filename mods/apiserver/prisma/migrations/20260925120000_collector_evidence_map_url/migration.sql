-- Collector evidence (openspec add-collector-evidence): the business location
-- is stored only as a Google Maps link. Additive: nullable columns, no data move.
ALTER TABLE "loan_applications" ADD COLUMN "map_url" TEXT;
ALTER TABLE "customers" ADD COLUMN "map_url" TEXT;
