/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * LLM prompt template for performance report narrative generation.
 */
import type { PortfolioMetrics, ReportNarrative } from "./types.js";

const BUSINESS_MODEL = `## Modelo de negocio
- Préstamos tipo "San": 30% interés, pagos semanales, plazo 10 semanas
- Préstamo estándar: 5,000 DOP / Préstamo mayor: 10,000 DOP`;

const TASK = `## Tarea
Genera un análisis ejecutivo conciso para un reporte de una página.
Responde SOLO con JSON válido, sin markdown ni texto extra:
{
  "executiveSummary": "2-3 oraciones resumiendo el estado del portafolio.",
  "keyInsights": ["insight1", "insight2", "insight3"],
  "riskAreas": ["risk1", ...],
  "recommendation": "1 oración con acción concreta"
}

Incluye riskAreas solo si hay riesgos reales (mora alta, pérdidas, etc.). Si el portafolio está sano, riskAreas puede ser [].`;

const RULES = `## Reglas
- Solo español
- No inventes datos: usa SOLO los números proporcionados en las métricas
- Sé directo y práctico
- Si el portafolio está sano, dilo claramente`;

/**
 * Builds the system + user prompt for the report narrative LLM call.
 */
export function buildReportNarrativePrompt(metrics: PortfolioMetrics): string {
  const { period } = metrics;
  const metricsJson = JSON.stringify(metrics, null, 2);
  return `${BUSINESS_MODEL}

## Métricas del portafolio (periodo: ${period.startDate} a ${period.endDate})
${metricsJson}

${TASK}

${RULES}`;
}

/**
 * Parses the LLM response into ReportNarrative.
 * Tolerates markdown code fences and trims whitespace.
 */
export function parseReportNarrativeResponse(raw: string): ReportNarrative {
  let text = raw.trim();
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    text = codeBlockMatch[1].trim();
  }
  const parsed = JSON.parse(text) as ReportNarrative;
  if (typeof parsed.executiveSummary !== "string") {
    throw new Error("executiveSummary must be a string");
  }
  if (!Array.isArray(parsed.keyInsights)) {
    throw new Error("keyInsights must be an array");
  }
  if (!Array.isArray(parsed.riskAreas)) {
    throw new Error("riskAreas must be an array");
  }
  if (typeof parsed.recommendation !== "string") {
    throw new Error("recommendation must be a string");
  }
  return {
    executiveSummary: parsed.executiveSummary,
    keyInsights: parsed.keyInsights,
    riskAreas: parsed.riskAreas,
    recommendation: parsed.recommendation
  };
}
