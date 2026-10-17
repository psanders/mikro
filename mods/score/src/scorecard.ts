/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Experimental internal credit score built from DataCrédito (Equifax RD) report data.
 * NOT the DataCrédito score: the bureau's model is proprietary. This is an expert
 * scorecard using the publicly documented factors and FICO-style category weights,
 * mapped onto DataCrédito RD's published 150–950 scale and bands.
 */
import type { Band, BureauFeatures, BureauReport, BureauScore, Category } from "./types.js";

export const SCALE = { min: 150, max: 950, base: 650 };

// DataCrédito RD bands (revistamercado.do). 150–299 is unlabeled in the source; folded into "Muy bajo".
export const BANDS: { min: number; label: Band }[] = [
  { min: 781, label: "Excelente" },
  { min: 720, label: "Bueno" },
  { min: 658, label: "Justo" },
  { min: 601, label: "Bajo" },
  { min: 150, label: "Muy bajo" }
];

// PDV legend → approximate days past due. '-' = no info.
const DPD: Record<string, number> = {
  "0": 0,
  ".": 15,
  "1": 30,
  "2": 60,
  S: 90,
  L: 120,
  I: 180,
  C: 360
};

// Telecom / utilities are reported but the bureau says the score focuses on risk products.
const NON_RISK_SECTORS = new Set(["TEL", "SER"]);
// Months of history (most recent first) that count toward worst-delinquency and late-month count.
const PAYMENT_WINDOW = 24;
const OPEN = new Set(["NORMAL", "MORA", "LEGAL", "CASTIGADO"]);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function monthsBetween(ym: string, ref: string) {
  const [y, m] = ym.split("-").map(Number);
  const r = new Date(ref);
  return (r.getFullYear() - y) * 12 + (r.getMonth() + 1 - m);
}

const dpdOf = (code: string): number | null => (code in DPD ? DPD[code] : null);

/** Extract model features from a report. Grids are most-recent-first. */
export function extractFeatures(report: BureauReport): BureauFeatures {
  const accounts = report.accounts;
  const risk = accounts.filter((a) => !NON_RISK_SECTORS.has(a.sector));
  const nonRisk = accounts.filter((a) => NON_RISK_SECTORS.has(a.sector));

  let worstRiskDpd = 0;
  let monthsSinceRiskDelinq: number | null = null;
  let delinquentMonths = 0;
  for (const a of risk) {
    [...a.pdv].forEach((c, i) => {
      const d = dpdOf(c);
      if (d === null || d === 0) return;
      if (monthsSinceRiskDelinq === null || i < monthsSinceRiskDelinq) monthsSinceRiskDelinq = i;
      if (i >= PAYMENT_WINDOW) return;
      worstRiskDpd = Math.max(worstRiskDpd, d);
      if (d >= 30) delinquentMonths++;
    });
  }

  let worstNonRiskDpd = 0;
  for (const a of nonRisk) {
    for (const c of a.pdv) worstNonRiskDpd = Math.max(worstNonRiskDpd, dpdOf(c) ?? 0);
  }

  const withInfo = accounts.filter((a) => [...a.pdv].some((c) => c !== "-"));
  const cleanClosed = risk.filter(
    (a) => a.status === "CANCELADA" && [...a.pdv].every((c) => c === "-" || c === "0")
  ).length;

  const open = risk.filter((a) => OPEN.has(a.status));
  const owed = open.reduce((s, a) => s + (a.owed ?? 0), 0);
  const overdue = open.reduce((s, a) => s + (a.overdue ?? 0), 0);

  // Latest reported utilization bucket (0–6) per open account.
  const latestUtil = open
    .map((a) => [...a.util].find((c) => c !== "-"))
    .filter((c): c is string => c !== undefined)
    .map(Number);

  const ref = report.reportDate;
  const inquiries6m = report.inquiries.filter(
    (q) => monthsBetween(q.date.slice(0, 7), ref) < 6
  ).length;

  const count = (s: string) => risk.filter((a) => a.status === s).length;

  return {
    accountsWithInfo: withInfo.length,
    worstRiskDpd,
    monthsSinceRiskDelinq,
    delinquentMonths,
    worstNonRiskDpd,
    cleanClosed,
    countByStatus: {
      NORMAL: count("NORMAL"),
      MORA: count("MORA"),
      LEGAL: count("LEGAL"),
      CASTIGADO: count("CASTIGADO")
    },
    owed,
    overdue,
    overdueRatio: owed > 0 ? overdue / owed : overdue > 0 ? 1 : 0,
    avgUtilBucket: latestUtil.length
      ? latestUtil.reduce((s, v) => s + v, 0) / latestUtil.length
      : null,
    oldestYears: monthsBetween(report.summary.oldestCredit, ref) / 12,
    newestMonths: monthsBetween(report.summary.newestCredit, ref),
    inquiries6m,
    hasBankProduct: risk.some((a) => a.sector === "BCO"),
    bankInGoodStanding: risk.some((a) => a.sector === "BCO" && a.status === "NORMAL")
  };
}

type Rule = (f: BureauFeatures) => [number, string?];

// Each rule returns points (+ good / − bad) and a reason shown when it hurts.
// Rough category budgets follow FICO: payment 35%, amounts 30%, length 15%, new 10%, mix 10%.
const RULES: [Category, Rule][] = [
  // --- Payment history (35%) ---
  [
    "payment",
    (f) => {
      const t: Record<number, number> = {
        0: 60,
        15: 30,
        30: -20,
        60: -60,
        90: -120,
        120: -150,
        180: -180,
        360: -180
      };
      return [t[f.worstRiskDpd], `Peor atraso en productos de riesgo: ${f.worstRiskDpd}+ días`];
    }
  ],
  [
    "payment",
    (f) => {
      const m = f.monthsSinceRiskDelinq;
      if (m === null) return [0];
      return [m <= 3 ? -40 : m <= 12 ? -20 : 0, `Atraso reciente (hace ${m} meses)`];
    }
  ],
  [
    "payment",
    (f) => [
      -Math.min(60, f.delinquentMonths * 3),
      `${f.delinquentMonths} meses-cuenta con 30+ días de atraso`
    ]
  ],
  [
    "payment",
    (f) => [
      -Math.min(40, Math.round(f.worstNonRiskDpd / 3)),
      `Atraso en telecom/servicios: ${f.worstNonRiskDpd} días`
    ]
  ],
  [
    "payment",
    (f) => [-Math.min(80, f.countByStatus.MORA * 40), `${f.countByStatus.MORA} cuenta(s) en mora`]
  ],
  [
    "payment",
    (f) => [
      -Math.min(150, f.countByStatus.LEGAL * 100),
      `${f.countByStatus.LEGAL} cuenta(s) en legal`
    ]
  ],
  [
    "payment",
    (f) => [
      -Math.min(200, f.countByStatus.CASTIGADO * 150),
      `${f.countByStatus.CASTIGADO} cuenta(s) castigada(s)`
    ]
  ],
  ["payment", (f) => [Math.min(40, f.cleanClosed * 5), "Cuentas canceladas sin atrasos"]],

  // --- Amounts owed (30%) ---
  [
    "amounts",
    (f) => {
      const r = f.overdueRatio;
      const p = r === 0 ? 30 : r < 0.1 ? 0 : r < 0.3 ? -30 : r < 0.6 ? -60 : -90;
      return [p, `Monto vencido = ${(r * 100).toFixed(0)}% de lo adeudado`];
    }
  ],
  [
    "amounts",
    (f) => {
      if (f.avgUtilBucket === null) return [0];
      const b = f.avgUtilBucket;
      const p = b < 1.5 ? 40 : b < 2.5 ? 20 : b < 3.5 ? 0 : b < 4.5 ? -20 : b < 5.5 ? -40 : -60;
      return [p, `Uso promedio de crédito alto (nivel ${b.toFixed(1)} de 6)`];
    }
  ],

  // --- Length of history (15%) ---
  [
    "length",
    (f) => {
      const y = f.oldestYears;
      return [
        y < 1 ? -30 : y < 2 ? -10 : y < 4 ? 10 : y < 7 ? 30 : 50,
        `Historial de ${y.toFixed(1)} años`
      ];
    }
  ],

  // --- New credit (10%) ---
  [
    "new",
    (f) => {
      const n = f.inquiries6m;
      return [
        n === 0 ? 20 : n <= 2 ? 0 : n <= 4 ? -20 : -40,
        `${n} consultas en los últimos 6 meses`
      ];
    }
  ],
  ["new", (f) => [f.newestMonths < 6 ? -10 : 0, "Crédito abierto recientemente"]],

  // --- Credit mix (10%) ---
  [
    "mix",
    (f) => [f.bankInGoodStanding ? 20 : f.hasBankProduct ? 0 : -10, "Sin producto bancario al día"]
  ]
];

// Hard caps: severe derogatories limit the ceiling regardless of positives.
function capFor(f: BureauFeatures) {
  if (f.countByStatus.CASTIGADO > 0 || f.countByStatus.LEGAL > 0) return 520;
  if (f.worstRiskDpd >= 90) return 600;
  return SCALE.max;
}

export function bandOf(score: number): Band {
  return (BANDS.find((b) => score >= b.min) ?? BANDS[BANDS.length - 1]).label;
}

export function scoreReport(report: BureauReport): BureauScore {
  const features = extractFeatures(report);
  if (features.accountsWithInfo === 0) {
    return {
      score: null,
      band: "Sin historial",
      features,
      reasons: ["Sin información crediticia suficiente"]
    };
  }

  const contributions = RULES.map(([category, rule]) => {
    const [points, reason] = rule(features);
    return { category, points, reason };
  });
  const raw = SCALE.base + contributions.reduce((s, c) => s + c.points, 0);
  const cap = capFor(features);
  const score = Math.round(clamp(Math.min(raw, cap), SCALE.min, SCALE.max));

  const byCategory = { payment: 0, amounts: 0, length: 0, new: 0, mix: 0 };
  for (const c of contributions) byCategory[c.category] += c.points;

  const reasons = contributions
    .filter((c) => c.points < 0 && c.reason)
    .sort((a, b) => a.points - b.points)
    .slice(0, 4)
    .map((c) => c.reason as string);

  return { score, band: bandOf(score), raw, cap, byCategory, reasons, features };
}
