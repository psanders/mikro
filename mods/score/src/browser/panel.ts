/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The Mikro Decisión panel (Pencil board "Extension / Mikro · Decisión").
 * Rendered in a shadow root so the portal's CSS can't reach it. Pure view:
 * content.ts owns the state and the actions.
 */
import type { PanelData } from "./protocol.js";
import { formatPhone } from "./session.js";

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
  | { kind: "no-session"; expired?: boolean; busy?: boolean; error?: string }
  | { kind: "error"; message: string };

export interface View {
  portal: "EQUIFAX" | "PRESTAMOSCLOUD" | null;
  cedula: string | null;
  phase: Phase;
  /** Who is logged in (null when nobody is). */
  user?: string | null;
  /** What the lookup showed, as label/value rows (from the pushed facts). */
  seen?: { label: string; value: string; bad?: boolean }[];
}

export interface Handlers {
  close(): void;
  login(phone: string, password: string): void;
  logout(): void;
  retry(): void;
  take(): void;
  rejectHardNo(): void;
  openForm(form: "reject" | "recommend" | "none"): void;
  submitReject(reason: string, note: string): void;
  submitRecommend(text: string): void;
}

// Colors are CSS variables so the panel follows the OS light/dark setting
// (extension: system only). Values match the dashboard's ds.* tokens.
const C = {
  blue: "var(--m-blue)",
  deep: "var(--m-deep)",
  ink: "var(--m-ink)",
  muted: "var(--m-muted)",
  border: "var(--m-border)",
  subtle: "var(--m-subtle)",
  green: "var(--m-green)",
  greenBg: "var(--m-green-bg)",
  amber: "var(--m-amber)",
  amberBg: "var(--m-amber-bg)",
  red: "var(--m-red)",
  redBg: "var(--m-red-bg)",
  violet: "var(--m-violet)",
  violetBg: "var(--m-violet-bg)"
};

const THEME = `
:host {
  --m-blue: #1F4AA8; --m-deep: #103A8A; --m-header: #1F4AA8; --m-ink: #14254A; --m-muted: #697A93;
  --m-border: #E5EAF1; --m-subtle: #EEF3F9; --m-surface: #FFFFFF; --m-disabled: #9AA8BC;
  --m-green: #16A34A; --m-green-bg: #E8F7EE; --m-amber: #D97706; --m-amber-bg: #FDF1E3;
  --m-red: #DC2626; --m-red-bg: #FCEBEB; --m-danger: #DC2626; --m-red-line: #F5C2C2; --m-violet: #7C3AED; --m-violet-bg: #F1EAFE;
  --m-shadow: #103A8A2E;
}
@media (prefers-color-scheme: dark) {
  :host {
    --m-blue: #3B7BE0; --m-deep: #103A8A; --m-header: #103A8A; --m-ink: #E9F2FF; --m-muted: #9FB0CC;
    --m-border: #24365C; --m-subtle: #17264A; --m-surface: #111C33; --m-disabled: #5F7090;
    --m-green: #4ADE80; --m-green-bg: #12301F; --m-amber: #FBBF24; --m-amber-bg: #33270E;
    --m-red: #F87171; --m-red-bg: #3A1A1C; --m-danger: #DC2626; --m-red-line: #5C2629; --m-violet: #A78BFA; --m-violet-bg: #2A2150;
    --m-shadow: #00000080;
  }
}
`;

const CSS = `
:host { all: initial; }
.panel { position: fixed; top: 16px; right: 16px; z-index: 2147483647; width: 320px; max-height: calc(100vh - 32px);
  overflow: auto; background: var(--m-surface); border: 1px solid ${C.border}; border-radius: 20px; font: 13px/1.4 Geist, Inter, system-ui, sans-serif;
  color: ${C.ink}; box-shadow: 0 12px 32px var(--m-shadow); }
.hd { display: flex; gap: 10px; align-items: center; padding: 12px 14px; background: var(--m-header); color: #fff; position: sticky; top: 0; }
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
.ko { background: ${C.redBg}; border: 1px solid var(--m-red-line); border-radius: 10px; padding: 10px 12px; margin-top: 10px; }
.ko .k { color: ${C.red}; font-size: 11px; font-weight: 700; letter-spacing: .4px; }
.li { display: flex; gap: 8px; align-items: baseline; margin-top: 4px; }
.li:before { content: ""; width: 5px; height: 5px; border-radius: 9px; background: currentColor; flex: none; transform: translateY(-2px); }
.sync { color: ${C.green}; font-size: 12px; font-weight: 500; padding-top: 12px; }
.btn { display: block; width: 100%; box-sizing: border-box; border-radius: 10px; padding: 11px 12px; font: 600 14px inherit; font-family: inherit;
  border: 1px solid transparent; cursor: pointer; margin-top: 8px; }
.btn:disabled { background: ${C.subtle} !important; color: var(--m-disabled) !important; border-color: ${C.subtle} !important; cursor: not-allowed; }
.primary { background: ${C.blue}; color: #fff; } .danger { background: var(--m-danger); color: #fff; } .ghost { background: var(--m-surface); color: ${C.ink}; border-color: ${C.border}; }
.hint { font-size: 11px; color: ${C.muted}; margin-top: 6px; }
.err { color: ${C.red}; font-size: 12px; margin-top: 8px; }
label { display: block; font-size: 11px; color: ${C.muted}; margin: 8px 0 4px; }
.lt { font-size: 18px; font-weight: 700; letter-spacing: -.3px; margin-bottom: 2px; }
input[type=tel], input[type=password] { width: 100%; box-sizing: border-box; border: 1px solid ${C.border}; border-radius: 8px; padding: 9px 10px; font: 13px inherit; font-family: inherit; color: ${C.ink}; background: var(--m-surface); }
.ft a { color: ${C.blue}; cursor: pointer; font-weight: 600; text-decoration: none; }
select, textarea { width: 100%; box-sizing: border-box; border: 1px solid ${C.border}; border-radius: 8px; padding: 8px 10px; font: 13px inherit; font-family: inherit; color: ${C.ink}; background: var(--m-surface); }
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

/** Same login as the Ops dashboard (LoginPage.tsx): Teléfono 809-555-0100 + Contraseña. */
function loginForm(p: Extract<Phase, { kind: "no-session" }>, on: Handlers): Child[] {
  const phone = h("input", {
    type: "tel",
    autocomplete: "username",
    placeholder: "809-555-0100",
    oninput: (e: Event) => {
      const el = e.target as HTMLInputElement;
      el.value = formatPhone(el.value);
    }
  }) as HTMLInputElement;
  const password = h("input", {
    type: "password",
    autocomplete: "current-password",
    placeholder: "••••••••••"
  }) as HTMLInputElement;
  const submit = (e: Event) => {
    e.preventDefault();
    on.login(phone.value, password.value);
  };
  return [
    h("div", { className: "lt" }, "Inicia sesión"),
    h(
      "div",
      { className: "meta", style: "margin-bottom:6px" },
      p.expired
        ? "Tu sesión venció. Inicia sesión de nuevo para guardar esta consulta."
        : "Con tu cuenta de Mikro, la misma de la app de Ops."
    ),
    h(
      "form",
      { onsubmit: submit },
      h("label", {}, "Teléfono"),
      phone,
      h("label", {}, "Contraseña"),
      password,
      p.error ? h("div", { className: "err", role: "alert" }, p.error) : null,
      h(
        "button",
        { className: "btn primary", type: "submit", disabled: p.busy },
        p.busy ? "Entrando…" : "Iniciar sesión"
      )
    ),
    h("div", { className: "hint" }, "No se envía nada sin sesión.")
  ];
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
      return loginForm(p, on);
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
    h("style", {}, THEME + CSS),
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
        v.user
          ? h("span", {}, `Sesión: ${v.user} · `, h("a", { onclick: on.logout }, "Cerrar sesión"))
          : "Mismas reglas de hoy: el evaluador rechaza o recomienda; el admin aprueba en Ops."
      )
    )
  );
}
