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
Escribe un resumen de 1 o 2 oraciones en español que capture el estado del cobro y los acuerdos o pasos siguientes. Sé conciso y factual. Responde solo con el texto del resumen, sin encabezados ni markdown.`;
}

/**
 * Returns the LLM response as the summary text (trimmed).
 */
export function parseLoanNotesSummaryResponse(raw: string): string {
  return raw.trim();
}
