/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Canonical machine-readable English result shape for the Mikro Score engine.
 */

export type RiskBand =
  | "LOW_RISK"
  | "MODERATE_RISK"
  | "MEDIUM_HIGH_RISK"
  | "HIGH_RISK"
  | "VERY_HIGH_RISK"
  | "OUT_OF_COVERAGE";

export type Recommendation =
  | "APPROVE"
  | "APPROVE_WITH_CONDITIONS"
  | "MANUAL_REVIEW"
  | "LIKELY_REJECT"
  | "REJECT"
  | "REJECT_OUT_OF_ZONE"
  | "REJECT_CRITICAL_BUSINESS";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export type FlagCode = "OUT_OF_ZONE" | "CRITICAL_BUSINESS" | "INCOMPLETE_DATA";

export type ScoreCategoryKey =
  | "PAYMENT_CAPACITY"
  | "BUSINESS_TYPE_RISK"
  | "TRACK_RECORD_FORMALIZATION"
  | "ROOTEDNESS_STABILITY"
  | "SUPPORT_NETWORK"
  | "LOAN_PURPOSE";

export interface ScoreFlag {
  code: FlagCode;
  message: string;
}

export interface ScoreCategory {
  category: ScoreCategoryKey;
  weight: number;
  score: number;
}

export interface ScoreIndicator {
  value: number | null;
  unit: string;
}

export interface ScoreIndicators {
  amount_requested: ScoreIndicator;
  term_weeks: ScoreIndicator;
  monthly_installment: ScoreIndicator;
  monthly_sales: ScoreIndicator;
  net_income: ScoreIndicator;
  debt_service_ratio: ScoreIndicator;
}

export interface EvaluatorNote {
  topic: string;
  question: string;
  reason: string;
}

export interface ApplicationScore {
  name: string;
  age: number | null;
  id_document: string;
  phone: string;
  business: {
    type_code: string;
    name: string;
    risk_level: string;
  };
  province: string;
  isc: number;
  risk_band: RiskBand;
  recommendation: Recommendation;
  confidence: Confidence;
  flags: ScoreFlag[];
  categories: ScoreCategory[];
  indicators: ScoreIndicators;
  evaluator_notes: EvaluatorNote[];
}
