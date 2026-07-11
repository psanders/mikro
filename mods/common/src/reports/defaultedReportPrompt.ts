/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * LLM prompt for summarizing loan notes into a concise line for the defaulted report.
 */

export interface NoteForSummary {
  content: string;
  createdAt: string;
  createdBy: string;
}

/**
 * Builds the prompt to summarize all notes for a single loan into one concise line.
 */
export function buildLoanNotesSummaryPrompt(notes: NoteForSummary[]): string {
  const lines = notes.map((n) => `- [${n.createdAt}] (${n.createdBy}): ${n.content}`);
  return `## Notas de seguimiento de cobranza (préstamo en default)

${lines.join("\n")}

## Tarea
Escribe UNA sola oración en español (máximo ~110 caracteres) que capture el estado del cobro y el próximo paso o acuerdo, si lo hay. Ve directo al grano: sin introducciones, sin repetir el nombre del cliente, sin relleno. Si no hay próximo paso claro, describe solo el estado actual. Responde solo con el texto del resumen, sin encabezados, comillas ni markdown.`;
}

/**
 * Returns the LLM response as the summary text (trimmed).
 */
export function parseLoanNotesSummaryResponse(raw: string): string {
  return raw.trim();
}
