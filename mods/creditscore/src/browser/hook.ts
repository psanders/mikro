/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Watches the page's own fetch/XHR traffic for the DATACREDITO report response and
 * scores it locally. Makes no requests of its own and sends nothing anywhere.
 */
import { CREDIT_BLOCKS, fromInteractiveReport } from "../adapter.js";
import { scoreReport } from "../scorecard.js";
import { renderError, renderScore } from "./panel.js";

const REPORT_URL = /\/products\/DATACREDITO\/reports(\?|$)/;

/** Scores a raw report response body (or a saved copy of it). */
export function handleReportText(text: string) {
  try {
    const json = JSON.parse(text);
    const data = json.data ?? json;
    // Keep only the credit-history blocks; accept saved files keyed with or without "bloque_".
    const credit = Object.fromEntries(
      CREDIT_BLOCKS.map((k) => [k, data[k] ?? data[k.replace("bloque_", "")]])
    );
    renderScore(scoreReport(fromInteractiveReport(credit)));
  } catch (e) {
    console.warn("[mikro-creditscore] could not score report", e);
    renderError("No se pudo leer el reporte.");
  }
}

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
        .then(handleReportText, () => {});
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
        handleReportText(
          this.responseType === "json" ? JSON.stringify(this.response) : this.responseText
        );
      });
    }
    return xhrSend.call(this, body);
  };
  return true;
}
