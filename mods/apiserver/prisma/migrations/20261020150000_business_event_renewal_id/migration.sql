-- Renewal events carry their renewal id as a first-class column so the feed can
-- join the live renewal state (like application_id does for applications).
-- Plain ADD COLUMN + index; no table rebuild.

-- AlterTable
ALTER TABLE "business_events" ADD COLUMN "renewal_id" TEXT;

-- CreateIndex
CREATE INDEX "business_events_renewal_id_idx" ON "business_events"("renewal_id");
