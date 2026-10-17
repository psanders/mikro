/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Equifax Interactive Reports: watches the page's own report responses (the
 * POST from "Generar Reporte" and the GET that reopens a saved report), turns
 * them into facts and hands them to the panel. Makes no requests of its own.
 */
import { toEquifaxFacts } from "../facts/equifax.js";
import { creditReportPushSchema, normalizeCedula } from "../facts/schema.js";
import { ADAPTER_VERSION, postToPanel, sha256Hex } from "./protocol.js";
import { watchResponses } from "./network.js";

export const REPORT_URL = /\/ar-interactive-reports[^/]*\/.*\/reports(\/[^/?]+)?(\?|$)/;

const MAX_DEPTH = 3;

/** Finds the object holding the credit blocks, wherever the response nests it. */
export function findReportData(json: unknown, depth = 0): Record<string, unknown> | null {
  if (!json || typeof json !== "object" || Array.isArray(json)) return null;
  const obj = json as Record<string, unknown>;
  if ("bloque_actividadcred" in obj || "actividadcred" in obj) return obj;
  if (depth >= MAX_DEPTH) return null;
  for (const v of Object.values(obj)) {
    const found = findReportData(v, depth + 1);
    if (found) return found;
  }
  return null;
}

const post = postToPanel;

/** The cédula on screen, when the report's identity block doesn't carry one. */
function cedulaOnPage(): string | null {
  const m = document.body?.innerText.match(/\b\d{3}-?\d{7}-?\d\b/);
  return m ? normalizeCedula(m[0]) : null;
}

export async function handleEquifaxResponse(text: string): Promise<boolean> {
  let data: Record<string, unknown> | null = null;
  try {
    data = findReportData(JSON.parse(text));
  } catch {
    return false; // not JSON: not a report
  }
  if (!data) return false;
  const { facts, cedula: fromReport } = toEquifaxFacts(data);
  const cedula = fromReport ?? cedulaOnPage();
  post({ type: "lookup-started", portal: "EQUIFAX", cedula });
  if (!cedula) {
    post({ type: "error", message: "No se encontró la cédula en el reporte." });
    return true;
  }
  const push = {
    source: "EQUIFAX" as const,
    cedula,
    capturedAt: new Date().toISOString(),
    portalOrigin: window.location.origin,
    adapterVersion: ADAPTER_VERSION,
    rawSha256: await sha256Hex(text),
    facts
  };
  const parsed = creditReportPushSchema.safeParse(push);
  if (!parsed.success) {
    console.warn("[mikro-decision] unknown Equifax format", parsed.error.issues.slice(0, 3));
    post({ type: "error", message: "Formato desconocido: no se envió nada." });
    return true;
  }
  post({ type: "facts", push: parsed.data });
  return true;
}

export function installEquifax(): void {
  watchResponses(
    (url) => REPORT_URL.test(url),
    (_url, text) => void handleEquifaxResponse(text)
  );
}
