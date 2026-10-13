/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Watches the page's own fetch/XHR traffic for the DATACREDITO report response and
 * scores it locally. Makes no requests of its own and sends nothing anywhere.
 */
import { CREDIT_BLOCKS, fromInteractiveReport } from "../adapter.js";
import { scoreReport } from "../scorecard.js";
import { renderError, renderScore } from "./panel.js";

// Any Interactive Reports API call that can carry a report: the POST from "Generar Reporte"
// (…/products/DATACREDITO/reports) and the GET that reopens a saved one from the history
// (…/reports/<reportId>). Responses are then recognized by content, not by URL.
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

/**
 * Scores a raw report response body (or a saved copy of it). Returns false when the body
 * isn't a report. `silent` is for intercepted traffic, where non-report responses
 * (e.g. the history list) are expected and shouldn't show an error.
 */
export function handleReportText(text: string, { silent = false } = {}): boolean {
  let data: Record<string, unknown> | null = null;
  try {
    data = findReportData(JSON.parse(text));
  } catch {
    // not JSON
  }
  if (!data) {
    if (!silent) renderError("El archivo no contiene un reporte de DataCrédito.");
    return false;
  }
  const found = data;
  try {
    // Keep only the credit-history blocks; accept saved files keyed with or without "bloque_".
    const credit = Object.fromEntries(
      CREDIT_BLOCKS.map((k) => [k, found[k] ?? found[k.replace("bloque_", "")]])
    );
    renderScore(scoreReport(fromInteractiveReport(credit)));
    return true;
  } catch (e) {
    console.warn("[mikro-creditscore] could not score report", e);
    renderError("No se pudo leer el reporte.");
    return false;
  }
}

const onIntercepted = (text: string) => handleReportText(text, { silent: true });

type Patched = { __mikroCreditscore?: boolean };

export function installHook() {
  const w = window as Window & Patched;
  if (w.__mikroCreditscore) return false;
  w.__mikroCreditscore = true;

  const origFetch = window.fetch;
  window.fetch = async function (...args: Parameters<typeof fetch>) {
    const res = await origFetch.apply(this, args);
    const input = args[0];
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (REPORT_URL.test(url) && res.ok)
      res
        .clone()
        .text()
        .then(onIntercepted, () => {});
    return res;
  };

  const xhrOpen = XMLHttpRequest.prototype.open;
  const xhrSend = XMLHttpRequest.prototype.send;
  type Tagged = XMLHttpRequest & { __mikroUrl?: string };
  XMLHttpRequest.prototype.open = function (this: Tagged, ...args: unknown[]) {
    this.__mikroUrl = String(args[1]);
    return (xhrOpen as (...a: unknown[]) => void).apply(this, args);
  };
  XMLHttpRequest.prototype.send = function (
    this: Tagged,
    body?: Document | XMLHttpRequestBodyInit | null
  ) {
    if (REPORT_URL.test(this.__mikroUrl ?? "")) {
      this.addEventListener("load", () => {
        if (this.status < 200 || this.status >= 300) return;
        onIntercepted(
          this.responseType === "json" ? JSON.stringify(this.response) : this.responseText
        );
      });
    }
    return xhrSend.call(this, body);
  };
  return true;
}
