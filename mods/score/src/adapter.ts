/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Maps the Interactive Reports API response (POST .../products/DATACREDITO/reports)
 * into the BureauReport the scorecard expects. Reads only the credit-history blocks;
 * identification (bloque_identi) and the bureau dashboard (bloque_dashb) are never touched.
 */
import type { AccountStatus, BureauReport } from "./types.js";

/** The four response blocks the adapter reads. Everything else is ignored. */
export const CREDIT_BLOCKS = [
  "bloque_actividadcred",
  "bloque_balancevenci",
  "bloque_analisiscred",
  "bloque_consul"
] as const;

/* eslint-disable @typescript-eslint/no-explicit-any -- untyped third-party payload */
type Payload = Record<string, any>;

const first = (block: any): any => (Array.isArray(block) ? block[0] : block) ?? {};

// "%>=20<40" → 2, "%>100" → 6, "0" → 0, "-" → "-"
function utilBucket(v: string | null | undefined): string {
  if (v === "-" || v == null) return "-";
  if (v === "0") return "0";
  const lo = Number((v.match(/>=?\s*(\d+)/) ?? [])[1]);
  if (Number.isNaN(lo)) return "-";
  if (lo >= 100) return "6";
  return String(Math.min(5, Math.floor(lo / 20) + 1));
}

function normalizeStatus(detail: any): AccountStatus {
  const s = String(detail?.status ?? "").toUpperCase();
  if (s.startsWith("CASTIGAD")) return "CASTIGADO";
  if (s.includes("LEGAL") && !s.includes("LEY")) return "LEGAL";
  if (s === "MORA") return "MORA";
  if (detail?.statusCuentaCerrada || s.startsWith("CANCELAD")) return "CANCELADA";
  return detail ? "NORMAL" : "CANCELADA";
}

// "dd/mm/yyyy" | "mm/yyyy" → "yyyy-mm"
function toYm(s: string | null | undefined): string | null {
  if (!s) return null;
  const p = s.split("/");
  return p.length === 3 ? `${p[2]}-${p[1]}` : `${p[1]}-${p[0]}`;
}

/**
 * @param data the response's `data` object (only the credit blocks are read)
 * @param reportDate ISO date the report was pulled
 */
export function fromInteractiveReport(
  data: Payload,
  reportDate: string = new Date().toISOString().slice(0, 10)
): BureauReport {
  const pick = (name: string) => first(data[`bloque_${name}`]?.[name]);
  const actividad = pick("actividadcred");
  const balance = pick("balancevenci");
  const analisis = pick("analisiscred");
  const consul = pick("consul");

  const details = new Map<number, any>();
  for (const tipo of Object.values<any>(balance.creditosPorTipo ?? {})) {
    for (const c of tipo.detallePorCredito ?? []) details.set(c.referencia, c);
  }
  const utilByRef = new Map<number, string[]>(
    (actividad.porcentajeMontosAdeudados ?? []).map((r: any) => [r.referencia, r.amount])
  );

  // API grids run oldest → newest; the scorecard wants most recent first.
  const accounts = (actividad.ventana48Meses ?? []).map((row: any) => {
    const d = details.get(row.referencia);
    const util = utilByRef.get(row.referencia) ?? [];
    return {
      ref: row.referencia,
      sector: row.economicAreaDescr,
      product: row.productTypeCode,
      currency: row.currencyCode,
      status: normalizeStatus(d),
      pdv: [...row.amount]
        .reverse()
        .map((c: string) => (c.length === 1 ? c : "-"))
        .join(""),
      util: [...util].reverse().map(utilBucket).join(""),
      approved: d?.creditoAprobado,
      owed: d?.totalAdeudado,
      installment: d?.cuota,
      overdue: d?.totalVencido,
      opened: toYm(d?.fechaApertura)
    };
  });

  const creditos = analisis.analisisDeLosCreditos ?? {};
  const inquiries = (consul.historial ?? []).map((h: any) => ({
    date: `${h.historyDateHour.slice(0, 4)}-${h.historyDateHour.slice(4, 6)}-${h.historyDateHour.slice(6, 8)}`,
    sector: h.historyEconomicSector
  }));

  return {
    reportDate,
    inquiries,
    summary: {
      oldestCredit: toYm(creditos.fechaCreditoMasAntiguo) ?? reportDate.slice(0, 7),
      newestCredit: toYm(creditos.fechaCreditoMasReciente) ?? reportDate.slice(0, 7)
    },
    accounts
  };
}
