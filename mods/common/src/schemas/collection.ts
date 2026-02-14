/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { z } from "zod";

/**
 * Input schema for the runCollections mutation.
 * Triggers the daily collections process on demand.
 */
export const runCollectionsSchema = z.object({
  /**
   * When true, log what would happen without sending any messages/calls
   * or writing CollectionAttempt records. Overrides the server-side
   * MIKRO_COLLECTIONS_DRY_RUN env var for this single run.
   */
  dryRun: z.boolean().optional().default(false)
});

export type RunCollectionsInput = z.infer<typeof runCollectionsSchema>;
