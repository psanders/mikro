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
  dryRun: z.boolean().optional().default(false),
  /**
   * When true, include loans with status DEFAULTED in addition to ACTIVE.
   */
  includeDefaulted: z.boolean().optional().default(false),
  /**
   * Optional Fonoster app ref override for collection calls in this run.
   */
  appRef: z.string().trim().min(1).optional()
});

export type RunCollectionsInput = z.infer<typeof runCollectionsSchema>;

/**
 * Input schema for the runSingleCollection mutation.
 * Sends a reminder, overdue notice, or collection call to a single loan.
 */
export const runSingleCollectionSchema = z.object({
  loanId: z.number().int().positive(),
  channel: z.enum(["WHATSAPP", "PHONE_CALL"]).optional(),
  type: z.enum(["PAYMENT_REMINDER", "OVERDUE_NOTICE", "COLLECTION_CALL"]).optional(),
  dryRun: z.boolean().optional().default(false),
  /**
   * When true, allow running collection for loans with status DEFAULTED (not only ACTIVE).
   */
  includeDefaulted: z.boolean().optional().default(false),
  /**
   * Optional Fonoster app ref override for this collection call.
   */
  appRef: z.string().trim().min(1).optional()
});

export type RunSingleCollectionInput = z.infer<typeof runSingleCollectionSchema>;
