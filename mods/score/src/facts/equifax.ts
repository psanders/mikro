/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Equifax Interactive Reports response → EquifaxFacts. The credit history comes
 * from the existing adapter (`fromInteractiveReport`). Identity (bloque_identi)
 * and Equifax's own score (bloque_dashb) are read defensively by key name: their
 * exact shape is confirmed against a real report, so unknown shapes yield null
 * instead of failing the whole push.
 */
import { CREDIT_BLOCKS, fromInteractiveReport } from "../adapter.js";
import { normalizeCedula, type EquifaxFacts } from "./schema.js";

/* eslint-disable @typescript-eslint/no-explicit-any -- untyped third-party payload */
type Payload = Record<string, any>;

/** Depth-first search for the first value whose key matches. */
function findKey(obj: unknown, test: (key: string) => boolean, depth = 0): unknown {
  if (!obj || typeof obj !== "object" || depth > 5) return undefined;
  if (Array.isArray(obj)) {
    for (const v of obj) {
      const f = findKey(v, test, depth + 1);
      if (f !== undefined) return f;
    }
    return undefined;
  }
  for (const [k, v] of Object.entries(obj)) {
    if (test(k.toLowerCase()) && v !== null && v !== "" && typeof v !== "object") return v;
  }
  for (const v of Object.values(obj)) {
    const f = findKey(v, test, depth + 1);
    if (f !== undefined) return f;
  }
  return undefined;
}

/** "20/04/1972" | "1972-04-20" | "19720420" → "1972-04-20". */
export function toIsoDate(raw: unknown): string | undefined {
  const s = String(raw ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return undefined;
}

const blockOf = (data: Payload, name: string) => data[`bloque_${name}`] ?? data[name];

export function readEquifaxIdentity(data: Payload): {
  identity: EquifaxFacts["identity"];
  cedula: string | null;
} {
  const block = blockOf(data, "identi");
  if (!block) return { identity: null, cedula: null };
  const full = findKey(block, (k) => k === "nombrecompleto" || k === "fullname");
  const names = findKey(block, (k) => k === "nombres" || k === "nombre");
  const last = findKey(block, (k) => k === "apellidos" || k === "apellido");
  const fullName = String(full ?? [names, last].filter(Boolean).join(" ")).trim();
  const birth = toIsoDate(findKey(block, (k) => k.includes("nacimiento") || k === "birthdate"));
  const cedula = normalizeCedula(
    String(findKey(block, (k) => k.includes("cedula") || k.includes("identificacion")) ?? "")
  );
  return {
    identity: fullName ? { fullName, ...(birth ? { birthDate: birth } : {}) } : null,
    cedula
  };
}

export function readEquifaxScore(data: Payload): EquifaxFacts["bureauScore"] {
  const block = blockOf(data, "dashb");
  if (!block) return null;
  const value = Number(
    findKey(block, (k) => k === "score" || k === "puntaje" || k === "puntuacion")
  );
  if (!Number.isFinite(value) || value <= 0) return null;
  const label = findKey(block, (k) => k.includes("rango") || k.includes("nivel") || k === "label");
  return { value, ...(label ? { label: String(label) } : {}) };
}

/**
 * @param data the report object holding the `bloque_*` blocks
 * @param reportDate ISO date the report was pulled
 */
export function toEquifaxFacts(
  data: Payload,
  reportDate: string = new Date().toISOString().slice(0, 10)
): { facts: EquifaxFacts; cedula: string | null } {
  const credit = Object.fromEntries(
    CREDIT_BLOCKS.map((k) => [k, data[k] ?? data[k.replace("bloque_", "")]])
  );
  const report = fromInteractiveReport(credit, reportDate);
  const { identity, cedula } = readEquifaxIdentity(data);
  return {
    cedula,
    facts: {
      identity,
      bureauScore: readEquifaxScore(data),
      reportDate,
      inquiries: report.inquiries,
      summary: report.summary,
      accounts: report.accounts.map((a) => ({
        ...a,
        opened: a.opened ?? null
      }))
    }
  };
}
