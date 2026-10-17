/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The Mikro Decisión panel (Pencil board "Extension / Mikro · Decisión").
 * Rendered in a shadow root so the portal's CSS can't reach it. Pure view:
 * content.ts owns the state and the actions.
 */
import type { PanelData } from "./protocol.js";

export type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "progress"; loaded: number; total: number }
  | { kind: "saving" }
  | {
      kind: "ready";
      data: PanelData;
      form: "none" | "reject" | "recommend";
      busy?: boolean;
      error?: string;
    }
  | { kind: "closed"; title: string; sub: string; ok: boolean }
  | { kind: "no-session" }
  | { kind: "error"; message: string };

export interface View {
  portal: "EQUIFAX" | "PRESTAMOSCLOUD" | null;
  cedula: string | null;
  phase: Phase;
  /** What the lookup showed, as label/value rows (from the pushed facts). */
  seen?: { label: string; value: string; bad?: boolean }[];
}

export interface Handlers {
  close(): void;
  login(): void;
  retry(): void;
  take(): void;
  rejectHardNo(): void;
  openForm(form: "reject" | "recommend" | "none"): void;
  submitReject(reason: string, note: string): void;
  submitRecommend(text: string): void;
}

const C = {
  blue: "#1F4AA8",
  deep: "#103A8A",
  ink: "#14254A",
  muted: "#697A93",
  border: "#E5EAF1",
  subtle: "#EEF3F9",
  green: "#16A34A",
  greenBg: "#E8F7EE",
  amber: "#D97706",
  amberBg: "#FDF1E3",
  red: "#DC2626",
  redBg: "#FCEBEB",
  violet: "#7C3AED",
  violetBg: "#F1EAFE"
};

const CSS = `
:host { all: initial; }
.panel { position: fixed; top: 16px; right: 16px; z-index: 2147483647; width: 320px; max-height: calc(100vh - 32px);
  overflow: auto; background: #fff; border: 1px solid ${C.border}; border-radius: 20px; font: 13px/1.4 Geist, Inter, system-ui, sans-serif;
  color: ${C.ink}; box-shadow: 0 12px 32px #103A8A2E; }
.hd { display: flex; gap: 10px; align-items: center; padding: 12px 14px; background: ${C.blue}; color: #fff; position: sticky; top: 0; }
.logo { width: 26px; height: 26px; border-radius: 8px; background: ${C.deep}; border: 1px solid #FFFFFF40; display: grid; place-items: center; font-weight: 700; font-size: 16px; }
.ttl { flex: 1; } .ttl b { display: block; font-size: 14px; font-weight: 600; } .ttl span { font-size: 11px; opacity: .8; }
.x { width: 26px; height: 26px; border-radius: 999px; border: 0; background: #FFFFFF26; color: #fff; cursor: pointer; font-size: 14px; }
.bd { padding: 14px; }
.ft { padding: 10px 14px; border-top: 1px solid ${C.border}; color: ${C.muted}; font-size: 11px; }
.app { display: flex; gap: 8px; align-items: center; background: ${C.subtle}; border-radius: 10px; padding: 8px 10px; }
.app .t { flex: 1; } .app b { display: block; font-size: 13px; } .app span { font-size: 11px; color: ${C.muted}; }
.pill { border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.score { display: flex; justify-content: space-between; align-items: center; padding-top: 14px; }
.score .v { font-size: 44px; font-weight: 700; letter-spacing: -.9px; line-height: 1; }
.score .of { font-size: 13px; color: ${C.muted}; margin-left: 4px; }
.meta { font-size: 11px; color: ${C.muted}; }
.h { padding: 14px 0 6px; font-size: 11px; font-weight: 600; color: ${C.muted}; letter-spacing: .5px; text-transform: uppercase; }
.row { display: flex; justify-content: space-between; background: ${C.subtle}; border-radius: 10px; padding: 6px 10px; margin-bottom: 4px; }
.row b { font-weight: 600; }
.ko { background: ${C.redBg}; border: 1px solid #F5C2C2; border-radius: 10px; padding: 10px 12px; margin-top: 10px; }
.ko .k { color: ${C.red}; font-size: 11px; font-weight: 700; letter-spacing: .4px; }
.li { display: flex; gap: 8px; align-items: baseline; margin-top: 4px; }
.li:before { content: ""; width: 5px; height: 5px; border-radius: 9px; background: currentColor; flex: none; transform: translateY(-2px); }
.sync { color: ${C.green}; font-size: 12px; font-weight: 500; padding-top: 12px; }
.btn { display: block; width: 100%; box-sizing: border-box; border-radius: 10px; padding: 11px 12px; font: 600 14px inherit; font-family: inherit;
  border: 1px solid transparent; cursor: pointer; margin-top: 8px; }
.btn:disabled { background: ${C.subtle} !important; color: #9AA8BC !important; border-color: ${C.subtle} !important; cursor: not-allowed; }
.primary { background: ${C.blue}; color: #fff; } .danger { background: ${C.red}; color: #fff; } .ghost { background: #fff; color: ${C.ink}; border-color: ${C.border}; }
.hint { font-size: 11px; color: ${C.muted}; margin-top: 6px; }
.err { color: ${C.red}; font-size: 12px; margin-top: 8px; }
label { display: block; font-size: 11px; color: ${C.muted}; margin: 8px 0 4px; }
select, textarea { width: 100%; box-sizing: border-box; border: 1px solid ${C.border}; border-radius: 8px; padding: 8px 10px; font: 13px inherit; font-family: inherit; color: ${C.ink}; }
textarea { min-height: 64px; resize: vertical; }
.bar { height: 8px; background: ${C.subtle}; border-radius: 99px; margin-top: 6px; overflow: hidden; } .bar i { display: block; height: 100%; background: ${C.blue}; }
.center { text-align: center; padding: 10px 0; } .center b { display: block; font-size: 16px; margin-bottom: 4px; }
`;

type Child = Node | string | null | false | undefined;
function h(tag: string, attrs: Record<string, unknown> = {}, ...children: Child[]): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith("on") && typeof v === "function")
      el.addEventListener(k.slice(2), v as EventListener);
    else if (k === "style") el.setAttribute("style", String(v));
    else if (k in el && k !== "list") (el as unknown as Record<string, unknown>)[k] = v;
    else el.setAttribute(k, String(v));
  }
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c);
  return el;
}

const money = (n: number | null) => (n === null ? "" : `RD$${n.toLocaleString("en-US")}`);
const mask = (c: string | null) => (c ? `${c.slice(0, 3)}-•••••${c.slice(-4)}` : "");
const PORTAL = { EQUIFAX: "Equifax", PRESTAMOSCLOUD: "PrestamosCloud" } as const;

const STATUS: Record<string, [string, string, string]> = {
  RECEIVED: ["Recibida", C.violet, C.violetBg],
  IN_REVIEW: ["En revisión", C.violet, C.violetBg],
  PENDING_DECISION: ["Esperando decisión", C.violet, C.violetBg]
};
const OUTCOME: Record<string, [string, string, string]> = {
  APPROVE: ["Aprobable", C.green, C.greenBg],
  REVIEW: ["Revisar", C.amber, C.amberBg],
  REJECT: ["Rechazo", C.red, C.redBg]
};
const REASONS: [string, string][] = [
  ["PAYMENT_CAPACITY", "Capacidad de pago"],
  ["DOCUMENTS", "Documentos"],
  ["OUT_OF_COVERAGE_AREA", "Fuera de zona"],
  ["OTHER", "Otro"]
];

const pill = ([label, fg, bg]: [string, string, string]) =>
  h("span", { className: "pill", style: `color:${fg};background:${bg}` }, label);

function ready(v: View, p: Extract<Phase, { kind: "ready" }>, on: Handlers): Child[] {
  const { data } = p;
  const app = data.application;
  const d = data.decision;
  const out: Child[] = [];
  if (!app) {
    return [
      h(
        "div",
        { className: "center" },
        h("b", {}, "Sin solicitud abierta"),
        h(
          "span",
          { className: "meta" },
          "Los datos quedan guardados con la cédula. Se usarán cuando esta persona aplique (30 días)."
        )
      ),
      h("div", { className: "sync" }, "✓ Guardado en Mikro · automático")
    ];
  }
  out.push(
    h(
      "div",
      { className: "app" },
      h(
        "div",
        { className: "t" },
        h("b", {}, app.name),
        h(
          "span",
          {},
          [
            money(app.requestedAmount),
            app.requestedTermWeeks ? `${app.requestedTermWeeks} sem` : ""
          ]
            .filter(Boolean)
            .join(" · ")
        )
      ),
      pill(STATUS[app.status] ?? [app.status, C.muted, C.subtle])
    )
  );
  if (d) {
    const before = data.previousScore;
    out.push(
      h(
        "div",
        { className: "score" },
        h(
          "div",
          {},
          h("span", { className: "v" }, d.mikroScore === null ? "—" : String(d.mikroScore)),
          h("span", { className: "of" }, "/ 100")
        ),
        pill(OUTCOME[d.outcome])
      ),
      h(
        "div",
        { className: "meta" },
        before !== null && d.mikroScore !== null && before !== d.mikroScore
          ? `Antes ${before} · Mikro Score con ${PORTAL[v.portal ?? "EQUIFAX"]}`
          : `Mikro Score · política ${d.policyVersion}`
      )
    );
    if (d.outcome === "REJECT") {
      out.push(
        h(
          "div",
          { className: "ko" },
          h("div", { className: "k" }, "NO DEFINITIVO · política de crédito"),
          ...d.reasons.map((r) =>
            h(
              "div",
              { className: "li", style: `color:${C.red}` },
              h("span", { style: `color:${C.ink}` }, r.message)
            )
          )
        )
      );
    } else if (d.reasons.length) {
      out.push(
        h(
          "div",
          { className: "meta", style: "margin-top:6px" },
          d.reasons.map((r) => r.message).join(" · ")
        )
      );
    }
    out.push(
      h("div", { className: "h" }, "Mikro Score por fuente"),
      ...d.components.map((c) =>
        h(
          "div",
          { className: "row" },
          h("span", {}, c.label),
          c.used
            ? h("b", {}, String(Math.round(c.mapped ?? 0)))
            : h("b", { style: `color:${C.muted};font-weight:400` }, "no consultado")
        )
      )
    );
    const unchecked = d.unchecked.filter((u) => u.outcome === "REJECT");
    if (unchecked.length) {
      out.push(
        h("div", { className: "h" }, "No verificado"),
        ...unchecked.map((u) =>
          h("div", { className: "li", style: `color:${C.muted}` }, h("span", {}, u.message))
        )
      );
    }
    if (d.nextSteps.length) {
      out.push(
        h("div", { className: "h" }, "Próximos pasos (opcionales)"),
        ...d.nextSteps.map((s) =>
          h(
            "div",
            { className: "row" },
            h("span", {}, s.label),
            h(
              "span",
              { className: "meta" },
              `${s.cost > 0 ? `cuesta ${s.cost} consulta` : "gratis"}${s.couldChange ? " · puede cambiar" : ""}`
            )
          )
        )
      );
    }
  }
  if (v.seen?.length) {
    out.push(
      h("div", { className: "h" }, `Lo que vio ${PORTAL[v.portal ?? "EQUIFAX"]}`),
      ...v.seen.map((r) =>
        h(
          "div",
          { className: "row" },
          h("span", {}, r.label),
          h("b", { style: r.bad ? `color:${C.red}` : "" }, r.value)
        )
      )
    );
  }
  out.push(h("div", { className: "sync" }, "✓ Guardado en Mikro · automático"));

  const a = data.actions;
  if (p.form === "reject") {
    const reasons =
      a.hardNoReason === "CREDIT_POLICY"
        ? [["CREDIT_POLICY", "Política de crédito"] as [string, string], ...REASONS]
        : REASONS;
    const sel = h(
      "select",
      {},
      ...reasons.map(([k, l]) => h("option", { value: k }, l))
    ) as HTMLSelectElement;
    const note = h("textarea", {
      placeholder: "Nota (obligatoria si es Otro)"
    }) as HTMLTextAreaElement;
    out.push(
      h("div", { className: "h" }, "Rechazar solicitud"),
      h("label", {}, "Motivo"),
      sel,
      h("label", {}, "Nota"),
      note,
      h(
        "button",
        {
          className: "btn danger",
          disabled: p.busy,
          onclick: () => on.submitReject(sel.value, note.value)
        },
        "Rechazar solicitud"
      ),
      h("button", { className: "btn ghost", onclick: () => on.openForm("none") }, "Cancelar")
    );
  } else if (p.form === "recommend") {
    const text = h("textarea", {}, app.reviewerRecommendation ?? "") as HTMLTextAreaElement;
    const blocked = a.sendBlockedBy.length > 0;
    out.push(
      h("div", { className: "h" }, "Tu recomendación"),
      text,
      blocked
        ? h(
            "div",
            { className: "hint", style: `color:${C.amber}` },
            `Falta: ${a.sendBlockedBy.join(", ")}`
          )
        : null,
      h(
        "button",
        {
          className: "btn primary",
          disabled: blocked || p.busy,
          onclick: () => on.submitRecommend(text.value)
        },
        blocked ? `Enviar a decisión · falta evidencia` : "Enviar a decisión"
      ),
      h("button", { className: "btn ghost", onclick: () => on.openForm("none") }, "Cancelar")
    );
  } else {
    if (a.take)
      out.push(
        h(
          "button",
          { className: "btn primary", disabled: p.busy, onclick: on.take },
          "Tomar solicitud"
        )
      );
    if (a.reject && a.hardNoReason) {
      out.push(
        h(
          "button",
          { className: "btn danger", disabled: p.busy, onclick: on.rejectHardNo },
          "Rechazar solicitud"
        ),
        h("div", { className: "hint" }, "Motivo: política de crédito. Sin comentario.")
      );
    }
    if (a.recommend) {
      out.push(
        h(
          "button",
          { className: "btn primary", onclick: () => on.openForm("recommend") },
          "Recomendar aprobación"
        )
      );
      if (d?.outcome === "REJECT") {
        out.push(
          h(
            "div",
            { className: "hint" },
            "Con un NO definitivo, el admin no podrá aprobarla en Ops."
          )
        );
      }
    }
    if (a.reject)
      out.push(
        h("button", { className: "btn ghost", onclick: () => on.openForm("reject") }, "Rechazar…")
      );
    if (!a.take && !a.reject && !a.recommend) {
      out.push(
        h(
          "div",
          { className: "hint" },
          app.assigneeName && !app.isMine
            ? `Asignada a ${app.assigneeName}.`
            : "Sin acciones para ti en este estado."
        )
      );
    }
  }
  if (p.error) out.push(h("div", { className: "err" }, p.error));
  return out;
}

function body(v: View, on: Handlers): Child[] {
  const p = v.phase;
  switch (p.kind) {
    case "idle":
    case "loading":
      return [h("div", { className: "meta" }, "Leyendo la consulta…")];
    case "progress":
      return [
        h("div", { className: "h" }, "Cargando préstamos por empresa"),
        h(
          "div",
          { className: "bar" },
          h("i", { style: `width:${p.total ? Math.round((p.loaded / p.total) * 100) : 0}%` })
        ),
        h(
          "div",
          { className: "meta", style: "margin-top:6px" },
          `${p.loaded} de ${p.total} empresas · abriendo cada una en la página`
        ),
        h("div", { className: "sync", style: `color:${C.blue}` }, "Se enviará a Mikro al terminar")
      ];
    case "saving":
      return [h("div", { className: "meta" }, "Guardando en Mikro…")];
    case "no-session":
      return [
        h(
          "div",
          {},
          "Inicia sesión con tu cuenta de Mikro para guardar esta consulta y ver el Mikro Score."
        ),
        h("button", { className: "btn primary", onclick: on.login }, "Iniciar sesión en Mikro"),
        h("button", { className: "btn ghost", onclick: on.retry }, "Ya inicié sesión: reintentar"),
        h("div", { className: "hint" }, "No se envía nada sin sesión.")
      ];
    case "error":
      return [
        h("div", { className: "err" }, p.message),
        h("button", { className: "btn ghost", onclick: on.retry }, "Reintentar")
      ];
    case "closed":
      return [
        h(
          "div",
          { className: "center" },
          h("b", { style: `color:${p.ok ? C.ink : C.red}` }, p.title),
          h("span", { className: "meta" }, p.sub)
        ),
        h("button", { className: "btn ghost", onclick: on.close }, "Cerrar")
      ];
    case "ready":
      return ready(v, p, on);
  }
}

export function render(root: ShadowRoot, v: View, on: Handlers): void {
  root.replaceChildren(
    h("style", {}, CSS),
    h(
      "div",
      { className: "panel" },
      h(
        "div",
        { className: "hd" },
        h("div", { className: "logo" }, "m"),
        h(
          "div",
          { className: "ttl" },
          h("b", {}, "Mikro · Decisión"),
          h(
            "span",
            {},
            [v.portal ? PORTAL[v.portal] : "", mask(v.cedula)].filter(Boolean).join(" · ")
          )
        ),
        h("button", { className: "x", title: "Cerrar", onclick: on.close }, "✕")
      ),
      h("div", { className: "bd" }, ...body(v, on)),
      h(
        "div",
        { className: "ft" },
        "Mismas reglas de hoy: el evaluador rechaza o recomienda; el admin aprueba en Ops."
      )
    )
  );
}
