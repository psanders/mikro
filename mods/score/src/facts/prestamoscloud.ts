/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * PrestamosCloud Datapréstamos page → PcloudFacts. The browser side scrapes the
 * rendered lookup into a `PcloudScrape` (labels, KPI texts, loan table rows);
 * this module turns that into typed facts. Pure, so it is unit-tested against a
 * fixture shaped like the real page (2026-10-17), with fake people.
 */
import { PCLOUD_LOAN_STATUSES, type PcloudFacts, type PcloudLoan } from "./schema.js";
import { toIsoDate } from "./equifax.js";

export interface PcloudScrape {
  identity: { fullName?: string; gender?: string; birthDate?: string } | null;
  kpis: {
    score?: string; // "399"
    scoreLabel?: string; // "Muy bajo (300-850)"
    onTime?: string; // "23%"
    completion?: string; // "60%"
    riskFactors?: string; // "4/4"
    riskLabel?: string; // "Riesgo alto"
  };
  /** Label → text of the summary block ("Cliente moroso" → "SI", …). */
  summary: Record<string, string>;
  lenders: {
    name: string;
    /** "9 prestamos" */
    count: string;
    /** "Total otorgado: RD$70,000.00 |Capital adeudado: RD$41,174.25" */
    totals: string;
    /** Loan rows: [monto, estado, condición final, atraso, inicio, calificación, capital adeudado]; null until loaded. */
    rows: string[][] | null;
  }[];
  inquiries: { type: string; date: string; lender: string }[];
  comments: { lender: string; recommends: boolean; date: string; text: string }[];
}

/** "RD$86,673.12" → 86673.12; "RD$-0.19" → -0.19; "—"/"" → null. */
export function parseMoney(raw: string | undefined): number | null {
  const s = String(raw ?? "").replace(/[^\d.,-]/g, "");
  if (!/\d/.test(s)) return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** "12" → 12; "" → 0 (the portal renders empty counts as blank). */
function parseCount(raw: string | undefined): number {
  const n = parseInt(String(raw ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

function parsePct(raw: string | undefined): number | null {
  const m = String(raw ?? "").match(/(\d+(?:\.\d+)?)\s*%/);
  return m ? Math.min(100, Number(m[1])) : null;
}

const MONTHS: Record<string, string> = {
  ene: "01",
  feb: "02",
  mar: "03",
  abr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  ago: "08",
  sep: "09",
  sept: "09",
  oct: "10",
  nov: "11",
  dic: "12"
};

/** "31 mar 2026" / "23 sept 2025" → "2026-03-31"; ISO passes through; else null. */
export function parseSpanishDate(raw: string | undefined): string | null {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase();
  const iso = toIsoDate(s);
  if (iso) return iso;
  const m = s.match(/^(\d{1,2})\s+([a-zñ]+)\.?\s+(\d{4})$/);
  if (!m || !MONTHS[m[2]]) return null;
  return `${m[3]}-${MONTHS[m[2]]}-${m[1].padStart(2, "0")}`;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

/** "VENCIDOSINCOBRABLE" / "Atrasados" / "AL DÍA" → status + uncollectible flag. */
export function parseLoanStatus(
  raw: string
): Pick<PcloudLoan, "status" | "statusRaw" | "uncollectible"> {
  const s = fold(raw);
  const uncollectible = s.includes("INCOBRABLE");
  const base = s.replace("INCOBRABLE", "").replace(/[^A-Z]/g, "");
  const known = base === "ALDIA" ? "AL_DIA" : base;
  if ((PCLOUD_LOAN_STATUSES as readonly string[]).includes(known) && known !== "OTHER") {
    return { status: known as PcloudLoan["status"], uncollectible };
  }
  return { status: "OTHER", statusRaw: raw.trim(), uncollectible };
}

export function parseFinalCondition(raw: string | undefined): PcloudLoan["finalCondition"] {
  const s = fold(String(raw ?? ""))
    .replace(/[^A-Z ]/g, "")
    .trim();
  if (!s) return null;
  if (s === "A TIEMPO") return "A_TIEMPO";
  if (s === "ATRASADOS" || s === "VENCIDOS" || s === "PENDIENTES") return s;
  return "OTHER";
}

function parseRating(raw: string | undefined): number | null {
  const n = Number(String(raw ?? "").trim());
  return raw && Number.isFinite(n) && n >= 0 && n <= 5 ? n : null;
}

export function parseLoanRow(row: string[]): PcloudLoan {
  const [amount, estado, condicion, atraso, inicio, calificacion, capital] = row;
  const days = String(atraso ?? "").match(/(\d+)\s*d/);
  return {
    amount: parseMoney(amount) ?? 0,
    ...parseLoanStatus(estado ?? ""),
    finalCondition: parseFinalCondition(condicion),
    daysLate: days ? Number(days[1]) : null,
    startDate: parseSpanishDate(inicio),
    rating: parseRating(calificacion),
    principalOwed: parseMoney(capital)
  };
}

/** True when every listed lender's loans are loaded (lenders start collapsed). */
export function allLendersLoaded(scrape: PcloudScrape): boolean {
  return scrape.lenders.every((l) => l.rows !== null);
}

function summaryValue(summary: Record<string, string>, label: string): string | undefined {
  const want = fold(label);
  const key = Object.keys(summary).find((k) => fold(k) === want);
  return key === undefined ? undefined : summary[key];
}

export function toPcloudFacts(scrape: PcloudScrape): PcloudFacts {
  const s = scrape.summary;
  const scoreValue = parseInt(String(scrape.kpis.score ?? ""), 10);
  const risk = String(scrape.kpis.riskFactors ?? "").match(/(\d+)\s*\/\s*(\d+)/);
  const gender = fold(scrape.identity?.gender ?? "");
  const birth = toIsoDate(scrape.identity?.birthDate);
  const fullName = scrape.identity?.fullName?.trim();
  return {
    identity: fullName
      ? {
          fullName,
          ...(birth ? { birthDate: birth } : {}),
          ...(gender.startsWith("M")
            ? { gender: "M" as const }
            : gender.startsWith("F")
              ? { gender: "F" as const }
              : {})
        }
      : null,
    kpis: {
      score:
        Number.isFinite(scoreValue) && scoreValue >= 300 && scoreValue <= 850
          ? {
              value: scoreValue,
              label: String(scrape.kpis.scoreLabel ?? "")
                .replace(/\s*\(.*\)\s*$/, "")
                .trim()
            }
          : null,
      onTimePct: parsePct(scrape.kpis.onTime),
      completionPct: parsePct(scrape.kpis.completion),
      riskFactors: risk
        ? {
            count: Number(risk[1]),
            max: Number(risk[2]),
            label: String(scrape.kpis.riskLabel ?? "").trim()
          }
        : null,
      isDelinquent: fold(summaryValue(s, "Cliente moroso") ?? "") === "SI",
      activeLoans: parseCount(summaryValue(s, "Préstamos activos")),
      closedLoans: parseCount(summaryValue(s, "Préstamos terminados")),
      lenderCount: parseCount(summaryValue(s, "Empresas con este cliente")),
      totalLent: parseMoney(summaryValue(s, "Capital prestado")) ?? 0,
      totalOwed: parseMoney(summaryValue(s, "Capital adeudado")) ?? 0,
      coSignerTotal: parseMoney(summaryValue(s, "Total codeudores")) ?? 0
    },
    lenders: scrape.lenders.map((l) => {
      const lent = l.totals.match(/otorgado:\s*([^|]+)/i);
      const owed = l.totals.match(/adeudado:\s*(.+)$/i);
      return {
        name: l.name.trim(),
        loanCount: parseCount(l.count),
        totalLent: parseMoney(lent?.[1]) ?? 0,
        totalOwed: parseMoney(owed?.[1]) ?? 0,
        loans: (l.rows ?? []).map(parseLoanRow)
      };
    }),
    inquiries: scrape.inquiries,
    comments: scrape.comments
  };
}
