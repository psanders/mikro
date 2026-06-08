/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
export { scoreApplication, scoreInput, CONFIG, type ScoreInput } from "./engine.js";
export {
  type ApplicationScore,
  type RiskBand,
  type Recommendation,
  type Confidence,
  type FlagCode,
  type ScoreCategoryKey,
  type ScoreFlag,
  type ScoreCategory,
  type ScoreIndicator,
  type ScoreIndicators,
  type EvaluatorNote
} from "./types.js";
export { MAPA_CODIGOS, PUNTAJE_POR_NIVEL, type RiskLevel } from "./data.js";
