/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Mikro-branded score panel. Renders into a shadow root so the host page's CSS can't
 * leak in, and follows the OS light/dark preference via prefers-color-scheme.
 */
import type { BureauScore } from "../types.js";

const HOST_ID = "mikro-creditscore";

// Same mark as mods/dashboard/public/favicon.svg.
const LOGO = `<svg viewBox="0 0 32 32" width="24" height="24" role="img" aria-label="Mikro"><rect width="32" height="32" rx="10" fill="#103A8A"/><text x="16" y="22.5" text-anchor="middle" fill="#FFFFFF" font-family="Geist, ui-sans-serif, system-ui, -apple-system, sans-serif" font-size="20" font-weight="700">m</text></svg>`;

const BAND_TONE: Record<string, string> = {
  Excelente: "good",
  Bueno: "good",
  Justo: "warn",
  Bajo: "alert",
  "Muy bajo": "bad",
  "Sin historial": "none"
};

const CATEGORY_LABELS: Record<string, string> = {
  payment: "Historial de pago",
  amounts: "Montos adeudados",
  length: "Antigüedad",
  new: "Crédito nuevo",
  mix: "Mezcla de crédito"
};

// Brand + ds tokens from mods/dashboard/src/index.css; dark values derived from the same palette.
const STYLES = `
  :host { all: initial; }
  .card {
    --surface: #ffffff; --subtle: #eef3f9; --border: #e5eaf1; --ink: #14254a; --muted: #697a93;
    --header: #1f4aa8; --header-ink: #ffffff; --track: #e9f2ff;
    --good: #16a34a; --good-bg: #e8f7ee; --warn: #d97706; --warn-bg: #fdf1e3;
    --alert: #e85b1c; --alert-bg: #fdeee5; --bad: #dc2626; --bad-bg: #fcebeb;
    --none: #697a93; --none-bg: #eef3f9; --accent: #f68a1f;
    position: fixed; left: 16px; bottom: 16px; z-index: 2147483647; width: 320px;
    max-height: calc(100vh - 32px); overflow: auto;
    font: 13px/1.45 Geist, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    color: var(--ink); background: var(--surface); border: 1px solid var(--border);
    border-radius: 20px; box-shadow: 0 12px 32px rgba(16, 58, 138, 0.18);
  }
  @media (prefers-color-scheme: dark) {
    .card {
      --surface: #111c33; --subtle: #17264a; --border: #24365c; --ink: #e9f2ff; --muted: #9fb0cc;
      --header: #103a8a; --header-ink: #e9f2ff; --track: #1c2d52;
      --good: #4ade80; --good-bg: #12351f; --warn: #fbbf24; --warn-bg: #3a2c0d;
      --alert: #fb923c; --alert-bg: #3d2010; --bad: #f87171; --bad-bg: #3b1518;
      --none: #9fb0cc; --none-bg: #17264a;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
    }
  }
  header {
    display: flex; align-items: center; gap: 10px; padding: 12px 14px;
    background: var(--header); color: var(--header-ink); border-radius: 19px 19px 0 0;
  }
  header svg { flex: none; border-radius: 8px; box-shadow: 0 0 0 1px rgba(255,255,255,.25); }
  .title { flex: 1; font-weight: 600; font-size: 14px; }
  .title small { display: block; font-weight: 400; font-size: 11px; opacity: .8; }
  button.close {
    border: 0; background: rgba(255,255,255,.15); color: inherit; width: 26px; height: 26px;
    border-radius: 9999px; font-size: 16px; line-height: 1; cursor: pointer;
  }
  button.close:hover { background: rgba(255,255,255,.28); }
  .body { padding: 14px; }
  .scoreline { display: flex; align-items: center; justify-content: space-between; }
  .num { font-size: 44px; font-weight: 700; letter-spacing: -0.02em; line-height: 1; }
  .num small { font-size: 13px; font-weight: 500; color: var(--muted); margin-left: 4px; }
  .pill {
    padding: 4px 10px; border-radius: 9999px; font-weight: 600; font-size: 12px;
    color: var(--tone); background: var(--tone-bg);
  }
  .gauge { position: relative; height: 8px; margin: 14px 0 4px; border-radius: 9999px;
    background: linear-gradient(90deg, var(--bad) 0 56%, var(--alert) 56% 63%, var(--warn) 63% 71%,
      var(--good) 71% 100%); opacity: .9; }
  .marker { position: absolute; top: -4px; width: 4px; height: 16px; margin-left: -2px;
    border-radius: 2px; background: var(--ink); box-shadow: 0 0 0 2px var(--surface); }
  .scale { display: flex; justify-content: space-between; font-size: 10px; color: var(--muted); }
  .meta { margin-top: 6px; font-size: 11px; color: var(--muted); }
  h4 { margin: 14px 0 6px; font-size: 11px; font-weight: 600; letter-spacing: .04em;
    text-transform: uppercase; color: var(--muted); }
  .cats { display: grid; gap: 4px; margin: 0; padding: 0; list-style: none; }
  .cats li { display: flex; justify-content: space-between; padding: 6px 10px;
    border-radius: 10px; background: var(--subtle); }
  .neg { color: var(--bad); font-weight: 600; } .pos { color: var(--good); font-weight: 600; }
  .reasons { margin: 0; padding-left: 18px; }
  .reasons li { margin: 2px 0; }
  .reasons li::marker { color: var(--accent); }
  footer { padding: 10px 14px; font-size: 11px; color: var(--muted); border-top: 1px solid var(--border); }
  .drop { margin-top: 10px; padding: 10px; border: 1px dashed var(--border); border-radius: 10px;
    text-align: center; color: var(--muted); }
  .drop label { color: var(--header); font-weight: 600; cursor: pointer; }
  @media (prefers-color-scheme: dark) { .drop label { color: #3f86e0; } }
  input[type=file] { display: none; }
`;

const esc = (s: unknown) =>
  String(s).replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string
  );

function mount(html: string) {
  document.getElementById(HOST_ID)?.remove();
  const host = document.createElement("div");
  host.id = HOST_ID;
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>${STYLES}</style>${html}`;
  root.querySelector("button.close")?.addEventListener("click", () => host.remove());
  (document.body ?? document.documentElement).appendChild(host);
  return root;
}

const shell = (body: string) => `
  <div class="card" role="dialog" aria-label="Mikro · Riesgo de buró">
    <header>${LOGO}
      <div class="title">Riesgo de buró<small>Mikro · experimental</small></div>
      <button class="close" title="Cerrar" aria-label="Cerrar">×</button>
    </header>
    <div class="body">${body}</div>
    <footer>Estimación interna de Mikro en escala 150–950. No es el score de DataCrédito.</footer>
  </div>`;

export function renderScore(result: BureauScore) {
  const tone = BAND_TONE[result.band] ?? "none";
  const pct = result.score == null ? null : ((result.score - 150) / 800) * 100;

  const categories = Object.entries(result.byCategory ?? {})
    .map(
      ([k, v]) =>
        `<li><span>${CATEGORY_LABELS[k] ?? k}</span><span class="${v < 0 ? "neg" : "pos"}">${v > 0 ? "+" : ""}${v}</span></li>`
    )
    .join("");
  const reasons = result.reasons.map((r) => `<li>${esc(r)}</li>`).join("");

  mount(
    shell(`
      <div class="scoreline" style="--tone: var(--${tone}); --tone-bg: var(--${tone}-bg)">
        <div class="num">${result.score ?? "—"}<small>/ 950</small></div>
        <span class="pill">${esc(result.band)}</span>
      </div>
      ${pct == null ? "" : `<div class="gauge"><div class="marker" style="left:${pct.toFixed(1)}%"></div></div><div class="scale"><span>150</span><span>600</span><span>720</span><span>950</span></div>`}
      ${result.raw != null ? `<div class="meta">Puntaje bruto ${result.raw} · tope ${result.cap}</div>` : ""}
      ${categories ? `<h4>Por factor</h4><ul class="cats">${categories}</ul>` : ""}
      ${reasons ? `<h4>Principales razones</h4><ul class="reasons">${reasons}</ul>` : ""}
    `)
  );
}

/** Console test mode: a panel that scores a saved report JSON picked from disk. */
export function renderLauncher(onFile: (text: string) => void) {
  const root = mount(
    shell(`
      <div>Escuchando: el próximo reporte que generes se puntuará aquí.</div>
      <div class="drop">o <label>prueba con un JSON guardado<input type="file" accept=".json,application/json"></label></div>
    `)
  );
  root.querySelector("input")?.addEventListener("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) onFile(await file.text());
  });
}

export function renderError(message: string) {
  mount(shell(`<div class="neg">${esc(message)}</div>`));
}
