/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Input and output shapes for the bureau scorecard.
 */

export type AccountStatus = "NORMAL" | "MORA" | "LEGAL" | "CASTIGADO" | "CANCELADA";

export interface BureauAccount {
  ref: number;
  /** DataCrédito economic sector code: BCO, FIN, PRE, COP, MYE, VMO, TEL, SER… */
  sector: string;
  product?: string;
  currency?: string;
  status: AccountStatus;
  /** Payment-status grid, most recent month first (PDV legend: - 0 . 1 2 S L I C). */
  pdv: string;
  /** Utilization bucket grid 0–6, most recent month first ("-" = no info). */
  util: string;
  approved?: number;
  owed?: number;
  installment?: number;
  overdue?: number;
  opened?: string | null;
}

export interface BureauReport {
  /** ISO date (yyyy-mm-dd) the report was pulled. */
  reportDate: string;
  inquiries: { date: string; sector?: string }[];
  summary: { oldestCredit: string; newestCredit: string };
  accounts: BureauAccount[];
}

export interface BureauFeatures {
  accountsWithInfo: number;
  worstRiskDpd: number;
  monthsSinceRiskDelinq: number | null;
  delinquentMonths: number;
  worstNonRiskDpd: number;
  cleanClosed: number;
  countByStatus: Record<"NORMAL" | "MORA" | "LEGAL" | "CASTIGADO", number>;
  owed: number;
  overdue: number;
  overdueRatio: number;
  avgUtilBucket: number | null;
  oldestYears: number;
  newestMonths: number;
  inquiries6m: number;
  hasBankProduct: boolean;
  bankInGoodStanding: boolean;
}

export type Category = "payment" | "amounts" | "length" | "new" | "mix";

export type Band = "Excelente" | "Bueno" | "Justo" | "Bajo" | "Muy bajo" | "Sin historial";

export interface BureauScore {
  score: number | null;
  band: Band;
  raw?: number;
  cap?: number;
  byCategory?: Record<Category, number>;
  reasons: string[];
  features: BureauFeatures;
}
