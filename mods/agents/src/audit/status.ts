/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The audit's verdict in words: the feed card's headline ("3 de 42
 * conversaciones no cumplen") and its one-paragraph status. When there are
 * problems the paragraph is written by the evals LLM from the findings; the
 * fixed template below is used for clean runs and whenever the LLM fails.
 */
import { z } from "zod";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { getLLMConfig } from "../config.js";
import { createChatModel } from "../llm/providers.js";
import type { AuditSeverity } from "./types.js";

export interface AuditStatusFinding {
  severity: AuditSeverity;
  agentName: string | null;
  rule: string;
  reason: string;
}

export interface AuditStatusInput {
  conversations: number;
  /** Conversations with at least one finding. */
  flaggedConversations: number;
  handoffs: number;
  /** Critical first. */
  findings: AuditStatusFinding[];
}

/** Writes the status paragraph for a run with problems. */
export type WriteAuditStatus = (input: AuditStatusInput) => Promise<string>;

/** Longest status we accept from the LLM before falling back to the template. */
const MAX_STATUS_CHARS = 400;

const AGENT_NAMES: Record<string, string> = {
  jose: "José",
  lucia: "Lucía",
  sofia: "Sofía",
  carmen: "Carmen"
};

/** "sofia" → "Sofía". */
export function agentLabel(name: string | null): string {
  if (!name) return "un agente";
  return AGENT_NAMES[name] ?? name.charAt(0).toUpperCase() + name.slice(1);
}

const convWord = (n: number) => `conversaci${n === 1 ? "ón" : "ones"}`;

/** "3 de las 42 conversaciones revisadas no cumplen." — worded for 1 and all-flagged too. */
export function auditCountingPhrase(conversations: number, flagged: number): string {
  if (conversations === 1) return "La conversación revisada no cumple.";
  if (flagged === conversations) return `Las ${conversations} conversaciones revisadas no cumplen.`;
  return `${flagged} de las ${conversations} conversaciones revisadas no ${flagged === 1 ? "cumple" : "cumplen"}.`;
}

/** The card's headline after "Auditoría de conversaciones". */
export function auditHeadline(conversations: number, flagged: number): string {
  if (conversations === 0) return "sin conversaciones nuevas";
  if (flagged === 0) {
    return conversations === 1
      ? "la conversación cumple"
      : `las ${conversations} conversaciones cumplen`;
  }
  if (conversations === 1) return "la conversación no cumple";
  if (flagged === conversations) return `las ${conversations} conversaciones no cumplen`;
  return `${flagged} de ${conversations} ${convWord(conversations)} no ${flagged === 1 ? "cumple" : "cumplen"}`;
}

/** The fixed-template status: clean runs, and the fallback when the LLM fails. */
export function auditStatusFallback(input: AuditStatusInput): string {
  const { conversations, flaggedConversations: flagged, handoffs, findings } = input;
  if (conversations === 0) return "No hubo conversaciones nuevas desde la auditoría anterior.";
  const handoffNote =
    handoffs > 0 ? ` ${handoffs} ${handoffs === 1 ? "pasó" : "pasaron"} a una persona.` : "";
  if (flagged === 0 || findings.length === 0) {
    const all =
      conversations === 1
        ? "La conversación revisada cumple las reglas."
        : `Las ${conversations} conversaciones revisadas cumplen las reglas.`;
    return `${all}${handoffNote}`;
  }
  const worst = findings[0]!;
  const others = findings.length - 1;
  const head = auditCountingPhrase(conversations, flagged);
  const grave = ` Lo más grave (${agentLabel(worst.agentName)}): ${worst.rule.replace(/\.$/, "")}.`;
  const more =
    others > 0 ? ` Hay ${others} problema${others === 1 ? "" : "s"} más en el detalle.` : "";
  return `${head}${grave}${more}`;
}

const statusSchema = z.object({
  status: z.string().describe("El párrafo de estado, en español, 1 a 3 oraciones")
});

const SYSTEM_PROMPT = `Resumes para el fundador de Mikro (financiera de microcréditos en República Dominicana) el resultado de una auditoría de las conversaciones de WhatsApp de sus agentes.

Escribe UN párrafo corto (1 a 3 oraciones, máximo 300 caracteres), en español claro y directo, sin markdown ni listas:
- Empieza exactamente con la frase de conteo que te doy.
- Luego di lo más grave, en palabras simples y concretas (qué hizo el agente), nombrando al agente.
- Si hay más problemas, menciónalos en pocas palabras al final.
- No inventes nada que no esté en los hallazgos. No des nombres de clientes ni números de teléfono.`;

/** The LLM-backed writer (evals model). Throws on failure; the caller falls back. */
export function createWriteAuditStatus(): WriteAuditStatus {
  return async (input) => {
    const model = createChatModel(getLLMConfig("evals"), { temperature: 0.2 });
    const structured = model.withStructuredOutput(statusSchema);
    const counting = auditCountingPhrase(input.conversations, input.flaggedConversations);
    const findings = input.findings
      .map(
        (f, i) =>
          `${i + 1}. [${f.severity === "CRITICAL" ? "crítico" : "advertencia"}] ${agentLabel(f.agentName)} — regla: ${f.rule} — qué pasó: ${f.reason}`
      )
      .join("\n");
    const result = await structured.invoke([
      new SystemMessage(SYSTEM_PROMPT),
      new HumanMessage(
        `Frase de conteo: ${counting}\n\nHallazgos (el más grave primero):\n${findings}`
      )
    ]);
    const status = result.status.trim();
    if (!status || status.length > MAX_STATUS_CHARS) {
      throw new Error(`status out of bounds (${status.length} chars)`);
    }
    return status;
  };
}
