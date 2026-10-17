/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Reads the Datapréstamos result from the page's visible text, as an ordered
 * list of text lines (one per rendered text node). Label-anchored, so layout
 * and class changes don't break it; only a relabel would. The lender loan
 * tables are read from the DOM by the browser side (see browser/pcloud.ts).
 */
import type { PcloudScrape } from "./prestamoscloud.js";

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();

function indexOfLabel(lines: string[], label: string, from = 0): number {
  const want = fold(label);
  for (let i = from; i < lines.length; i++) if (fold(lines[i]) === want) return i;
  return -1;
}

/** KPI cards render value, LABEL, subtitle: "399", "SCORE CREDITICIO", "Muy bajo (300-850)". */
export function kpisFromLines(lines: string[]): PcloudScrape["kpis"] {
  // The intro cards above reuse the same words ("Score crediticio"), so take the
  // occurrence whose previous line is a KPI value (399, 23%, 4/4, NO DATOS).
  const VALUE = /^(\d+(\.\d+)?%?|\d+\s*\/\s*\d+|NO DATOS)$/i;
  const around = (label: string) => {
    for (let i = indexOfLabel(lines, label); i >= 0; i = indexOfLabel(lines, label, i + 1)) {
      if (i > 0 && VALUE.test(lines[i - 1].trim()))
        return { value: lines[i - 1], sub: lines[i + 1] };
    }
    return {};
  };
  const score = around("SCORE CREDITICIO");
  const onTime = around("PAGOS A TIEMPO");
  const completion = around("COMPLETACION");
  const risk = around("FACTORES DE RIESGO");
  return {
    score: score.value,
    scoreLabel: score.sub,
    onTime: onTime.value,
    completion: completion.value,
    riskFactors: risk.value,
    riskLabel: risk.sub
  };
}

export const PCLOUD_SUMMARY_LABELS = [
  "Cliente moroso",
  "Préstamos activos",
  "Préstamos terminados",
  "Empresas con este cliente",
  "Capital prestado",
  "Total codeudores",
  "Moneda",
  "Capital adeudado"
] as const;

/** The summary block renders "Label", "value" pairs. The first occurrence wins. */
export function summaryFromLines(lines: string[]): Record<string, string> {
  const start = indexOfLabel(lines, "Cliente moroso");
  const out: Record<string, string> = {};
  if (start < 0) return out;
  for (const label of PCLOUD_SUMMARY_LABELS) {
    const i = indexOfLabel(lines, label, start);
    if (i >= 0 && i + 1 < lines.length) out[label] = lines[i + 1];
  }
  return out;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Name, gender and birth date render just above "Cliente moroso" when the person is known. */
export function identityFromLines(lines: string[]): PcloudScrape["identity"] {
  const i = indexOfLabel(lines, "Cliente moroso");
  if (i < 3 || !DATE.test(lines[i - 1] ?? "")) return null;
  const gender = lines[i - 2];
  if (!/^(masculino|femenino)$/i.test(gender ?? "")) return null;
  return { fullName: lines[i - 3], gender, birthDate: lines[i - 1] };
}

/** "Historial de consultas de este cliente": (type, date, lender) triples. */
export function inquiriesFromLines(lines: string[]): PcloudScrape["inquiries"] {
  const start = indexOfLabel(lines, "Historial de consultas de este cliente");
  if (start < 0) return [];
  const end = indexOfLabel(lines, "Comentarios de empresas sobre este cliente", start);
  const block = lines.slice(start + 1, end < 0 ? undefined : end);
  const out: PcloudScrape["inquiries"] = [];
  for (let i = 0; i < block.length - 2; i++) {
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(block[i + 1])) {
      out.push({ type: block[i], date: block[i + 1], lender: block[i + 2] });
      i += 2;
    }
  }
  return out;
}

/** The cédula searched, as typed in the Datapréstamos input or the lookup URL. */
export function cedulaFromLookupUrl(url: string): string | null {
  const m = url.match(/[?&]document_id=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}
