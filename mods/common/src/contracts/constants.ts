/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Non-sensitive presentation constants for the Mikro loan contract. The legal-
 * entity data (creditor, payment account, notary) is real PII and lives in
 * mikro.json — read it via getContractConfig() from the config module.
 */

/** Brand palette used in the contract chrome (matches the dashboard tokens). */
export const CONTRACT_BRAND = {
  blue: "#1F4AA8",
  deep: "#103A8A",
  ink: "#14254A",
  muted: "#697A93",
  border: "#E5EAF1",
  subtle: "#EEF3F9"
} as const;

export const FREQUENCY_PLURAL: Record<string, string> = {
  DAILY: "DIARIAS",
  WEEKLY: "SEMANALES",
  BIWEEKLY: "QUINCENALES",
  MONTHLY: "MENSUALES"
};

export const FREQUENCY_LABEL: Record<string, string> = {
  DAILY: "Diaria",
  WEEKLY: "Semanal",
  BIWEEKLY: "Quincenal",
  MONTHLY: "Mensual"
};
