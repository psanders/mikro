/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * LLM prompt for a short renewal candidacy note (good/risky candidate + one-sentence rationale).
 */

export interface RenewalCandidateContext {
  paymentRating: number;
  remainingInstallments: number;
  termLength: number;
  paymentsMade: number;
  missedPayments: number;
}

/**
 * Builds the prompt for a one-sentence candidacy note: good candidate for renewal or not, and why.
 */
export function buildRenewalCandidateNotePrompt(ctx: RenewalCandidateContext): string {
  return `## Contexto del préstamo (candidato a renovación)
- Calificación de pago (1-5): ${ctx.paymentRating}
- Cuotas pagadas: ${ctx.paymentsMade} de ${ctx.termLength}
- Cuotas pendientes: ${ctx.remainingInstallments}
- Cuotas atrasadas (no pagadas a tiempo): ${ctx.missedPayments}

## Tarea
Escribe una sola oración en español que indique si es buen candidato para un nuevo préstamo o no, y la razón breve (ej: "Buen candidato: pagó a tiempo la mayoría de las cuotas." o "Riesgo: varios pagos atrasados."). Responde solo con esa oración, sin encabezados ni markdown.`;
}

/**
 * Returns the LLM response as the candidate note (trimmed).
 */
export function parseRenewalCandidateNoteResponse(raw: string): string {
  return raw.trim();
}
