/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * PrestamosCloud Datapréstamos (portal.prestamoscloud.com, #clientes/dataprestamos).
 * A lookup starts with the portal's own GET clientes/get_client_data?document_id=…;
 * the rest of its clientes/* responses follow. Each lender's loans load only
 * when that lender is expanded, so the panel expands every lender (the portal
 * makes its own requests) and sends nothing until all of them have loaded.
 */
import { toPcloudFacts, allLendersLoaded, type PcloudScrape } from "../facts/prestamoscloud.js";
import {
  cedulaFromLookupUrl,
  identityFromLines,
  inquiriesFromLines,
  kpisFromLines,
  summaryFromLines
} from "../facts/pcloudText.js";
import { creditReportPushSchema, normalizeCedula } from "../facts/schema.js";
import { ADAPTER_VERSION, postToPanel, sha256Hex } from "./protocol.js";
import { watchResponses } from "./network.js";

const LOOKUP_START = /\/clientes\/get_client_data\b/;
const LOOKUP_PART = /\/(clientes|reports)\/(get|[a-z_]*dataprestamo)/i;
const COUNT = /^\s*(\d+)\s+prestamos?\s*$/i;
const SETTLE_MS = 900;
const GIVE_UP_MS = 15_000;

interface Lookup {
  cedula: string | null;
  raw: string[];
  clicked: WeakSet<Element>;
  sent: boolean;
  timer?: number;
  lastProgressAt: number;
}

let lookup: Lookup | null = null;

const post = postToPanel;

/** Visible text, one entry per text node, in document order (our panel lives in a shadow root). */
export function pageLines(root: Node = document.body): string[] {
  const out: string[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      n.parentElement && ["SCRIPT", "STYLE", "NOSCRIPT"].includes(n.parentElement.tagName)
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT
  });
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = (n.textContent ?? "").replace(/\s+/g, " ").trim();
    if (t) out.push(t);
  }
  return out;
}

interface LenderNode {
  name: string;
  count: string;
  totals: string;
  rows: string[][] | null;
  toggle: Element;
}

function countLeaves(root: Element): Element[] {
  return [...root.querySelectorAll("*")].filter(
    (e) => e.children.length === 0 && COUNT.test(e.textContent ?? "")
  );
}

function readLenders(): LenderNode[] {
  return countLeaves(document.body).flatMap((leaf) => {
    let header: Element | null = leaf;
    for (
      let i = 0;
      i < 5 && header && !(header.textContent ?? "").includes("Total otorgado");
      i++
    ) {
      header = header.parentElement;
    }
    if (!header) return [];
    const lines = (header as HTMLElement).innerText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const at = lines.findIndex((l) => COUNT.test(l));
    const totals = lines.filter((l) => /otorgado|adeudado/i.test(l)).join(" ");
    // The lender's container: climb while it holds only this lender, looking for its loan table.
    let rows: string[][] | null = null;
    let c: Element | null = header.parentElement;
    while (c && countLeaves(c).length === 1) {
      const table = c.querySelector("table");
      if (table) {
        const r = [...table.querySelectorAll("tr")]
          .map((tr) =>
            [...(tr as HTMLTableRowElement).cells].map((td) => (td as HTMLElement).innerText.trim())
          )
          .filter((cells) => cells.length >= 7 && /RD\$/.test(cells[0]));
        rows = r.length ? r : null;
        break;
      }
      c = c.parentElement;
    }
    const toggle =
      leaf.closest(
        "[data-bs-toggle],[data-toggle],[onclick],.accordion-button,.card-header,button,a"
      ) ??
      leaf.parentElement ??
      leaf;
    return [{ name: lines[at - 1] ?? "", count: lines[at] ?? "", totals, rows, toggle }];
  });
}

async function finish(l: Lookup, lenders: LenderNode[], lines: string[]) {
  const scrape: PcloudScrape = {
    identity: identityFromLines(lines),
    kpis: kpisFromLines(lines),
    summary: summaryFromLines(lines),
    lenders: lenders.map(({ name, count, totals, rows }) => ({ name, count, totals, rows })),
    inquiries: inquiriesFromLines(lines),
    comments: []
  };
  if (!allLendersLoaded(scrape)) return;
  const cedula = normalizeCedula(l.cedula);
  if (!cedula) {
    post({ type: "error", message: "No se encontró la cédula consultada." });
    return;
  }
  l.sent = true;
  const push = {
    source: "PRESTAMOSCLOUD" as const,
    cedula,
    capturedAt: new Date().toISOString(),
    portalOrigin: window.location.origin,
    adapterVersion: ADAPTER_VERSION,
    rawSha256: await sha256Hex(l.raw.join("\n")),
    facts: toPcloudFacts(scrape)
  };
  const parsed = creditReportPushSchema.safeParse(push);
  if (!parsed.success) {
    console.warn("[mikro-decision] unknown PrestamosCloud format", parsed.error.issues.slice(0, 3));
    post({ type: "error", message: "Formato desconocido: no se envió nada." });
    return;
  }
  post({ type: "facts", push: parsed.data });
}

function step() {
  const l = lookup;
  if (!l || l.sent) return;
  const lines = pageLines();
  if (!lines.some((t) => /^cliente moroso$/i.test(t))) return; // result not rendered yet
  const lenders = readLenders();
  const loaded = lenders.filter((x) => x.rows !== null).length;
  post({ type: "progress", loaded, total: lenders.length });
  if (loaded === lenders.length) {
    void finish(l, lenders, lines);
    return;
  }
  for (const x of lenders) {
    if (x.rows === null && !l.clicked.has(x.toggle)) {
      l.clicked.add(x.toggle);
      (x.toggle as HTMLElement).click();
    }
  }
  if (Date.now() - l.lastProgressAt > GIVE_UP_MS) {
    post({
      type: "error",
      message: `No cargaron los préstamos de ${lenders.length - loaded} empresas. Ábrelas y vuelve a intentar.`
    });
    return;
  }
  schedule();
}

function schedule() {
  if (!lookup) return;
  window.clearTimeout(lookup.timer);
  lookup.timer = window.setTimeout(step, SETTLE_MS);
}

export function installPrestamosCloud(): void {
  watchResponses(
    (url) => LOOKUP_PART.test(url),
    (url, text) => {
      if (LOOKUP_START.test(url)) {
        if (lookup) window.clearTimeout(lookup.timer);
        lookup = {
          cedula: cedulaFromLookupUrl(url),
          raw: [],
          clicked: new WeakSet(),
          sent: false,
          lastProgressAt: Date.now()
        };
        post({
          type: "lookup-started",
          portal: "PRESTAMOSCLOUD",
          cedula: normalizeCedula(lookup.cedula)
        });
      }
      if (!lookup || lookup.sent) return;
      lookup.raw.push(text);
      lookup.lastProgressAt = Date.now();
      schedule();
    }
  );
}
