/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Fixed legal-entity constants for the Mikro loan contract (creditor, the
 * payment account, and the certifying notary). Taken from the current paper
 * contract. Edit here if the business details change.
 */

export const CONTRACT_CONSTANTS = {
  creditor: {
    legalName: "Mikro, S.R.L.",
    rnc: "1-33-61735-8",
    address: "Avenida Penetración Portuaria #37, Puerto Plata, República Dominicana",
    representative: {
      name: "PEDRO SANTIAGO SANDERS ALMONTE",
      cedula: "037-0089330-2",
      city: "Puerto Plata"
    }
  },
  payment: {
    bank: "Asociación Cibao de Ahorros y Préstamos",
    accountType: "cuenta de ahorros",
    accountNumber: "100140036926",
    accountHolder: "MADELINE TORRES ESTÉVEZ",
    accountHolderCedula: "031-0375655-1"
  },
  mora: { ratePct: 10, periodDays: 30 },
  city: "Puerto Plata",
  notary: {
    name: "LICDO. RAMÓN ANTONIO SANTOS SILVERIO",
    collegeNumber: "5912",
    rnc: "087-0001240-8",
    office: "avenida Luis Ginebra No. 16 Altos, Puerto Plata, República Dominicana",
    municipality: "Puerto Plata"
  }
} as const;

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
