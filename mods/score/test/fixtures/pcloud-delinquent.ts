/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * A Datapréstamos lookup as the browser scrapes it, shaped like the real page
 * seen on 2026-10-17 (KPIs, summary labels, lender groups, loan rows). People,
 * lenders and amounts are fake.
 */
import type { PcloudScrape } from "../../src/facts/prestamoscloud.js";

export const delinquentScrape: PcloudScrape = {
  identity: { fullName: "Ramón Ortiz", gender: "Masculino", birthDate: "1972-04-20" },
  kpis: {
    score: "399",
    scoreLabel: "Muy bajo (300-850)",
    onTime: "23%",
    completion: "60%",
    riskFactors: "4/4",
    riskLabel: "Riesgo alto"
  },
  summary: {
    "Cliente moroso": "SI",
    "Préstamos activos": "12",
    "Préstamos terminados": "18",
    "Empresas con este cliente": "14",
    "Capital prestado": "RD$254,900.00",
    "Total codeudores": "0.00",
    Moneda: "RD",
    "Capital adeudado": "RD$86,673.12"
  },
  lenders: [
    {
      name: "Inversiones Uno",
      count: "3 prestamos",
      totals: "Total otorgado: RD$25,000.00 |Capital adeudado: RD$12,000.00",
      rows: [
        ["RD$10,000.00", "ATRASADOS", "—", "200 d", "31 mar 2026", "", "RD$10,000.00"],
        ["RD$10,000.00", "TERMINADOS", "A TIEMPO", "—", "04 ago 2025", "", "RD$5,869.59"],
        ["RD$5,000.00", "VENCIDOSINCOBRABLE", "—", "570 d", "23 sept 2024", "", "RD$2,000.00"]
      ]
    },
    {
      name: "Préstamos Dos",
      count: "2 prestamos",
      totals: "Total otorgado: RD$20,000.00 |Capital adeudado: RD$15,384.62",
      rows: [
        ["RD$12,000.00", "ATRASADOS INCOBRABLE", "—", "409 d", "05 dic 2024", "", "RD$12,000.00"],
        ["RD$8,000.00", "TERMINADOS", "PENDIENTES", "—", "17 feb 2025", "3", "RD$3,384.62"]
      ]
    },
    {
      name: "Soluciones Tres",
      count: "1 prestamo",
      totals: "Total otorgado: RD$5,000.00 |Capital adeudado: RD$-0.19",
      rows: [
        ["RD$5,000.00", "VENCIDOS INCOBRABLE", "VENCIDOS", "696 d", "12 ene 2024", "", "RD$-0.19"]
      ]
    }
  ],
  inquiries: [
    { type: "Consulta", date: "2026-10-17 09:42:47", lender: "Mikro" },
    { type: "Análisis IA", date: "2026-07-03 01:38:08", lender: "Soluciones Tres" }
  ],
  comments: []
};

/** The "NO DATOS" result: the cédula isn't in the pooled database. */
export const emptyScrape: PcloudScrape = {
  identity: null,
  kpis: { score: "NO DATOS", scoreLabel: "" },
  summary: {
    "Cliente moroso": "NO",
    "Préstamos activos": "0",
    "Préstamos terminados": "0",
    "Empresas con este cliente": "0",
    "Capital prestado": "RD$0.00",
    "Total codeudores": "0.00",
    "Capital adeudado": "0.00"
  },
  lenders: [],
  inquiries: [{ type: "Consulta", date: "2026-10-17 09:32:15", lender: "Mikro" }],
  comments: []
};
