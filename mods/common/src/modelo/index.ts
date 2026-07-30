/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Node-only Modelo calibration (reads mikro.db via node:sqlite). Imported via
 * `@mikro/common/modelo` — keep out of the root barrel so browser bundles
 * (dashboard, mobile) never pull it in.
 */
export {
  calibrateFromDb,
  cohortStartMonth,
  cohortLabel,
  blendCollectionRate
} from "./calibrate.js";
export type { ModeloCalibration, ModeloCohort } from "./calibrate.js";
