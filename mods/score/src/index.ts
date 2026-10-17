/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * @mikro/score — bureau facts, the Equifax scorecard, and the credit policy engine
 * behind the Mikro Score. The Mikro Decisión Chrome extension lives in src/browser.
 */
export * from "./types.js";
export { SCALE, BANDS, bandOf, extractFeatures, scoreReport } from "./scorecard.js";
export { CREDIT_BLOCKS, fromInteractiveReport } from "./adapter.js";
export * from "./facts/schema.js";
export {
  toEquifaxFacts,
  readEquifaxIdentity,
  readEquifaxScore,
  toIsoDate
} from "./facts/equifax.js";
export {
  toPcloudFacts,
  allLendersLoaded,
  parseLoanRow,
  parseLoanStatus,
  parseMoney,
  parseSpanishDate,
  type PcloudScrape
} from "./facts/prestamoscloud.js";
export { nameMatches, birthDateMatches } from "./facts/identity.js";
export { lookupSummary, pcloudSummary, equifaxSummary, type LookupRow } from "./facts/summary.js";
export {
  kpisFromLines,
  summaryFromLines,
  identityFromLines,
  inquiriesFromLines,
  cedulaFromLookupUrl,
  PCLOUD_SUMMARY_LABELS
} from "./facts/pcloudText.js";
export * from "./policy/schema.js";
export { evaluateCreditPolicy } from "./policy/evaluate.js";
export type {
  Decision,
  Facts,
  NextStep,
  Reason,
  UncheckedRule,
  ComponentResult
} from "./policy/evaluate.js";
export { POLICY_V1 } from "./policy/v1.js";
