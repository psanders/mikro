/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ApplicationAttribution, DbClient, MetaAd } from "@mikro/common";
import { logger } from "../../logger.js";

/**
 * Creates a function that records the ad an application came from in the local
 * ad catalog.
 *
 * The catalog is how the ad-quality report prints "MIKRO | Business owner | v2"
 * instead of a 15-digit id. Names are learned from the `{{ad.name}}` URL
 * parameters the click carried, never fetched from Meta: the report has to work
 * offline, and an ad that has been deleted in Ads Manager still has to show up
 * in the numbers it produced while it ran.
 *
 * Names are refreshed on every visit (an ad renamed in Ads Manager reports under
 * its current name), but a submission that carries an id without a name does not
 * blank a name we already learned.
 *
 * @param client - The database client
 */
export function createRecordMetaAd(client: DbClient) {
  return async (attribution: ApplicationAttribution): Promise<MetaAd | null> => {
    if (!attribution.adId) return null;

    const names = {
      ...(attribution.adName ? { name: attribution.adName } : {}),
      ...(attribution.adsetName ? { adsetName: attribution.adsetName } : {}),
      ...(attribution.campaignName ? { campaignName: attribution.campaignName } : {})
    };
    const ids = {
      adsetId: attribution.adsetId,
      campaignId: attribution.campaignId
    };

    const ad = await client.metaAd.upsert({
      where: { id: attribution.adId },
      create: { id: attribution.adId, ...ids, ...names },
      update: { ...ids, ...names }
    });

    logger.verbose("meta ad catalogued", { adId: ad.id, name: ad.name });
    return ad;
  };
}
