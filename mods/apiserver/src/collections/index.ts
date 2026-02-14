/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Collections engagement: payment confirmations, reminders, overdue notices, collection calls.
 */

export { runDailyCollections } from "./runDailyCollections.js";
export { runSingleCollection } from "./runSingleCollection.js";
export { sendPaymentConfirmation } from "./sendPaymentConfirmation.js";
export { initiateCollectionCall, buildCollectionCallPartialPrompt } from "./fonosterClient.js";
export type { InitiateCollectionCallParams } from "./fonosterClient.js";
export type { SendPaymentConfirmationDeps } from "./sendPaymentConfirmation.js";
export type { RunDailyCollectionsDeps } from "./runDailyCollections.js";
export type { RunSingleCollectionDeps, RunSingleCollectionInput, RunSingleCollectionResult } from "./runSingleCollection.js";
export type { CollectionDeps, CollectionTarget } from "./collectionAttemptHelper.js";
export { isDryRun } from "./collectionAttemptHelper.js";
export { getWhatsAppLanguageCode } from "./collectionConfig.js";
