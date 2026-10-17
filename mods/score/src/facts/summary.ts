/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * "Lo que vio …": a few facts from one bureau lookup, as the evaluator saw them.
 * Shared by the Mikro Decisión panel and the solicitud PDF so both say the same.
 */
import type { EquifaxFacts, PcloudFacts } from "./schema.js";

export interface LookupRow {
  label: string;
  value: string;
  /** A negative signal (shown in red). */
  bad?: boolean;
}

const money = (n: number) => `RD$${Math.round(n).toLocaleString("en-US")}`;

export function pcloudSummary(f: PcloudFacts): LookupRow[] {
  const k = f.kpis;
  const uncollectible = f.lenders.flatMap((l) => l.loans).filter((l) => l.uncollectible).length;
  return [
    {
      label: "Score Datapréstamos",
      value: k.score ? `${k.score.value} · ${k.score.label}` : "Sin datos",
      bad: !!k.score && k.score.value < 580
    },
    ...(k.onTimePct === null
      ? []
      : [{ label: "Pagos a tiempo", value: `${k.onTimePct}%`, bad: k.onTimePct < 60 }]),
    { label: "Cliente moroso", value: k.isDelinquent ? "Sí" : "No", bad: k.isDelinquent },
    ...(uncollectible
      ? [{ label: "Préstamos incobrables", value: String(uncollectible), bad: true }]
      : []),
    { label: "Empresas con el cliente", value: String(k.lenderCount) },
    { label: "Capital adeudado", value: money(k.totalOwed) }
  ];
}

export function equifaxSummary(f: EquifaxFacts): LookupRow[] {
  const count = (s: string) => f.accounts.filter((a) => a.status === s).length;
  return [
    ...(f.bureauScore
      ? [
          {
            label: "Score Equifax",
            value: `${f.bureauScore.value}${f.bureauScore.label ? ` · ${f.bureauScore.label}` : ""}`
          }
        ]
      : []),
    { label: "Cuentas", value: String(f.accounts.length) },
    ...(["MORA", "LEGAL", "CASTIGADO"] as const)
      .filter((s) => count(s) > 0)
      .map((s) => ({ label: `En ${s.toLowerCase()}`, value: String(count(s)), bad: true })),
    { label: "Consultas recientes", value: String(f.inquiries.length) }
  ];
}

export function lookupSummary(
  source: "EQUIFAX" | "PRESTAMOSCLOUD",
  facts: EquifaxFacts | PcloudFacts
): LookupRow[] {
  return source === "PRESTAMOSCLOUD"
    ? pcloudSummary(facts as PcloudFacts)
    : equifaxSummary(facts as EquifaxFacts);
}
