/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Content script: owns the panel's state. Receives facts from the page script,
 * saves them to Mikro automatically (the background worker holds the token),
 * shows the Mikro Score, and runs the evaluator's review actions with today's
 * rules — the same tRPC procedures the Ops app uses, tagged via "extension".
 */
import type { CreditReportPush } from "../facts/schema.js";
import { isPageMessage, type ApiRequest, type ApiResponse, type PanelData } from "./protocol.js";
import { render, type Handlers, type View } from "./panel.js";

const host = document.createElement("mikro-decision");
const root = host.attachShadow({ mode: "closed" });
let view: View = { portal: null, cedula: null, phase: { kind: "idle" } };
let pending: CreditReportPush | null = null;

async function api<T>(
  kind: ApiRequest["kind"],
  path: string,
  input: unknown
): Promise<ApiResponse<T>> {
  try {
    return (await chrome.runtime.sendMessage({ type: "api", kind, path, input })) as ApiResponse<T>;
  } catch (e) {
    return {
      ok: false,
      code: "ERROR",
      message: `La extensión se actualizó: recarga la página (${(e as Error).message})`
    };
  }
}

function set(next: Partial<View>) {
  view = { ...view, ...next };
  if (!host.isConnected) document.documentElement.append(host);
  render(root, view, handlers);
}

function failed(res: Extract<ApiResponse, { ok: false }>) {
  if (res.code === "NO_SESSION" || res.code === "UNAUTHORIZED") {
    set({ user: null, phase: { kind: "no-session", expired: res.code === "UNAUTHORIZED" } });
  } else set({ phase: { kind: "error", message: res.message } });
}

async function whoami() {
  try {
    const r = (await chrome.runtime.sendMessage({ type: "whoami" })) as { name: string | null };
    view = { ...view, user: r.name };
  } catch {
    /* extension reloaded: the next API call says so */
  }
}

/** "Lo que vio …": a few facts from the lookup itself, as the evaluator saw them. */
function seenOf(push: CreditReportPush): View["seen"] {
  const money = (n: number) => `RD$${Math.round(n).toLocaleString("en-US")}`;
  if (push.source === "PRESTAMOSCLOUD") {
    const k = push.facts.kpis;
    const bad = push.facts.lenders.flatMap((l) => l.loans).filter((l) => l.uncollectible).length;
    return [
      {
        label: "Score Datapréstamos",
        value: k.score ? `${k.score.value} · ${k.score.label}` : "Sin datos",
        bad: !!k.score && k.score.value < 580
      },
      ...(k.onTimePct === null
        ? []
        : [{ label: "Pagos a tiempo", value: `${k.onTimePct}%`, bad: k.onTimePct < 60 }]),
      { label: "Cliente moroso", value: k.isDelinquent ? "Sí" : "No", bad: k.isDelinquent },
      ...(bad ? [{ label: "Préstamos incobrables", value: String(bad), bad: true }] : []),
      { label: "Empresas con el cliente", value: String(k.lenderCount) },
      { label: "Capital adeudado", value: money(k.totalOwed) }
    ];
  }
  const f = push.facts;
  const count = (s: string) => f.accounts.filter((a) => a.status === s).length;
  return [
    ...(f.bureauScore
      ? [
          {
            label: "Score Equifax",
            value: `${f.bureauScore.value}${f.bureauScore.label ? ` · ${f.bureauScore.label}` : ""}`
          }
        ]
      : []),
    { label: "Cuentas", value: String(f.accounts.length) },
    ...(["MORA", "LEGAL", "CASTIGADO"] as const)
      .filter((s) => count(s) > 0)
      .map((s) => ({ label: `En ${s.toLowerCase()}`, value: String(count(s)), bad: true })),
    { label: "Consultas recientes", value: String(f.inquiries.length) }
  ];
}

async function save(push: CreditReportPush) {
  pending = push;
  set({ cedula: push.cedula, seen: seenOf(push), phase: { kind: "saving" } });
  const res = await api<PanelData>("mutation", "ingestCreditReport", push);
  if (!res.ok) return failed(res);
  pending = null;
  set({ phase: { kind: "ready", data: res.data, form: "none" } });
}

async function reload(data: PanelData) {
  const res = await api<PanelData>("query", "getCreditPanel", { cedula: data.cedula });
  if (!res.ok) return failed(res);
  set({ phase: { kind: "ready", data: res.data, form: "none" } });
}

function current() {
  return view.phase.kind === "ready" ? view.phase : null;
}

async function act(
  path: string,
  input: Record<string, unknown>,
  after: () => void | Promise<void>
) {
  const p = current();
  if (!p?.data.application) return;
  set({ phase: { ...p, busy: true, error: undefined } });
  const res = await api("mutation", path, {
    id: p.data.application.id,
    via: "extension",
    ...input
  });
  if (!res.ok) {
    if (res.code === "NO_SESSION" || res.code === "UNAUTHORIZED") return failed(res);
    set({ phase: { ...p, busy: false, error: res.message } });
    return;
  }
  await after();
}

const handlers: Handlers = {
  close: () => host.remove(),
  login: (phone, password) => {
    const p = view.phase;
    if (p.kind !== "no-session") return;
    set({ phase: { ...p, busy: true, error: undefined } });
    void (async () => {
      const r = (await chrome.runtime.sendMessage({ type: "login", phone, password })) as
        | { ok: true; name: string }
        | { ok: false; message: string };
      if (!r.ok) return set({ phase: { ...p, busy: false, error: r.message } });
      set({ user: r.name });
      if (pending) await save(pending);
      else
        set({
          phase: {
            kind: "error",
            message: "Sesión iniciada. Vuelve a hacer la consulta en el portal."
          }
        });
    })();
  },
  logout: () => {
    void chrome.runtime
      .sendMessage({ type: "logout" })
      .then(() => set({ user: null, phase: { kind: "no-session" } }));
  },
  retry: () => {
    if (pending) void save(pending);
    else set({ phase: { kind: "error", message: "Vuelve a hacer la consulta en el portal." } });
  },
  openForm: (form) => {
    const p = current();
    if (p) set({ phase: { ...p, form, error: undefined } });
  },
  take: () => {
    const p = current()!;
    void act("assignApplication", {}, () => reload(p.data));
  },
  rejectHardNo: () => {
    const p = current()!;
    const reason = p.data.actions.hardNoReason!;
    void act("rejectApplication", { reason }, () =>
      set({
        phase: {
          kind: "closed",
          ok: false,
          title: "Solicitud rechazada",
          sub: `${p.data.application!.name} · ${p.data.decision?.reasons.map((r) => r.message).join(", ") ?? ""}`
        }
      })
    );
  },
  submitReject: (reason, note) => {
    const p = current()!;
    if (reason === "OTHER" && !note.trim()) {
      set({ phase: { ...p, error: "Escribe una nota: es obligatoria con el motivo Otro." } });
      return;
    }
    void act("rejectApplication", { reason, ...(note.trim() ? { note: note.trim() } : {}) }, () =>
      set({
        phase: {
          kind: "closed",
          ok: false,
          title: "Solicitud rechazada",
          sub: p.data.application!.name
        }
      })
    );
  },
  submitRecommend: (text) => {
    const p = current()!;
    if (!text.trim()) {
      set({ phase: { ...p, error: "Escribe tu recomendación." } });
      return;
    }
    void act("setApplicationRecommendation", { reviewerRecommendation: text.trim() }, () =>
      act("sendApplicationToDecision", {}, () =>
        set({
          phase: {
            kind: "closed",
            ok: true,
            title: "Enviada a decisión",
            sub: `${p.data.application!.name} · el admin decide en Ops`
          }
        })
      )
    );
  }
};

window.addEventListener("message", (event) => {
  if (event.source !== window || !isPageMessage(event.data)) return;
  const m = event.data;
  if (m.type === "lookup-started") {
    set({ portal: m.portal, cedula: m.cedula, seen: undefined, phase: { kind: "loading" } });
    void whoami().then(() => set({}));
  } else if (m.type === "progress")
    set({ phase: { kind: "progress", loaded: m.loaded, total: m.total } });
  else if (m.type === "error") set({ phase: { kind: "error", message: m.message } });
  else if (m.type === "facts") void save(m.push);
});
