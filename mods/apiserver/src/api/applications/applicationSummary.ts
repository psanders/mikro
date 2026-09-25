/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The one-paragraph "Resumen IA" on an application's feed card and panel.
 * Generated when the application is received and after each data edit, then
 * stored — opening a card never calls the model. Follows the explainLoanHealth
 * pattern: with no model wired (tests, local dev without keys) it does nothing,
 * and a model failure is logged, never surfaced to the person who triggered it.
 */
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import {
  BUSINESS_TYPE_LABELS,
  PROVINCE_LABELS,
  type DbClient,
  type LoanApplication
} from "@mikro/common";
import { logger } from "../../logger.js";

const SYSTEM_PROMPT = `Eres analista de crédito de Mikro, una microfinanciera en República Dominicana.
Escribe UN párrafo (máximo 3 oraciones, sin viñetas ni títulos) que resuma la solicitud para quien decide.

REGLAS:
- Usa SOLO los datos dados. Nunca inventes ni calcules cifras nuevas salvo la proporción cuota/ventas si ambos datos están.
- Menciona: tipo y antigüedad del negocio, ventas, lo pedido (monto y plazo), vivienda/referencia si están.
- Si falta algo relevante (cédula, ventas, referencia), dilo al final en pocas palabras.
- No des una recomendación de aprobar o rechazar: eso lo decide una persona.
- Español neutro, tono profesional y breve.`;

let modelFactory: (() => BaseChatModel) | undefined;

/** Wire the chat model once at startup (index.ts). Unset = summaries are skipped. */
export function setApplicationSummaryModel(factory: (() => BaseChatModel) | undefined): void {
  modelFactory = factory;
}

function raw(app: LoanApplication, key: string): string | undefined {
  const data = (app.rawData ?? {}) as Record<string, unknown>;
  const v = data[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** The facts the model may use, as labelled lines. Pure; exported for tests. */
export function buildSummaryFacts(app: LoanApplication): string {
  const amount = app.requestedAmount != null ? Number(app.requestedAmount) : undefined;
  const lines: Array<[string, string | number | undefined | null]> = [
    ["Negocio", app.businessName],
    [
      "Tipo de negocio",
      app.businessType ? (BUSINESS_TYPE_LABELS[app.businessType] ?? app.businessType) : undefined
    ],
    ["Antigüedad del negocio", raw(app, "businessAge")],
    ["Ventas mensuales", raw(app, "monthlySales")],
    ["Local", raw(app, "locationType")],
    ["Formalización", raw(app, "formalization")],
    ["Empleados", raw(app, "employeeCount")],
    ["Provincia", app.province ? (PROVINCE_LABELS[app.province] ?? app.province) : undefined],
    ["Monto pedido (RD$)", amount],
    ["Plazo pedido (semanas)", app.requestedTermWeeks],
    ["Propósito", app.purpose],
    ["Vivienda", raw(app, "housingType")],
    ["Tiempo en la vivienda", raw(app, "residenceTime")],
    ["Referencia", raw(app, "referenceName")],
    ["Mikro Score", app.score],
    ["Cédula frente", app.idFrontFilename ? "sí" : "no"],
    ["Cédula reverso", app.idBackFilename ? "sí" : "no"]
  ];
  return lines
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) =>
        typeof p === "string" ? p : p && typeof p === "object" && "text" in p ? String(p.text) : ""
      )
      .join("");
  }
  return "";
}

/**
 * Regenerate and store the summary for one application. Resolves either way;
 * callers fire-and-forget it after the mutation that made it stale.
 */
export async function refreshApplicationSummary(
  client: DbClient,
  applicationId: string
): Promise<void> {
  if (!modelFactory) return;
  try {
    const app = await client.loanApplication.findUnique({ where: { id: applicationId } });
    if (!app) return;
    const reply = await modelFactory().invoke([
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(`Datos de la solicitud:\n${buildSummaryFacts(app)}`)
    ]);
    const summary = textOf(reply.content).trim();
    if (!summary) return;
    await client.loanApplication.update({
      where: { id: applicationId },
      data: { aiSummary: summary.slice(0, 1200), aiSummaryAt: new Date() }
    });
  } catch (err) {
    logger.error("application summary failed", {
      applicationId,
      error: (err as Error).message
    });
  }
}
