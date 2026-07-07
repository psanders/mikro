/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * LLM narration for a single loan's health. The model NEVER computes a number —
 * every figure (cuotas covered, balance, mora, days late) is produced by the
 * deterministic eval engine and handed to the model as facts. Its only job is to
 * narrate, in Spanish, HOW the ledger led to those figures so a founder can
 * follow the reasoning. Check rationales are passed in so the explanation is
 * grounded in the same spec the checks enforce.
 */
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { COLLECTIONS_CHECKS, type LoanSnapshot, type EvalReport } from "@mikro/common";

const SYSTEM_PROMPT = `Eres el analista de cobros de Mikro. Explicas, en español claro y breve, cómo se llegó a los números de un préstamo.

REGLAS ESTRICTAS:
- NUNCA calcules ni inventes cifras. TODAS las cifras (cuotas cubiertas, saldo, mora, días de atraso, pendientes) vienen dadas en los datos; úsalas tal cual.
- Explica el RECORRIDO del ledger: qué pagos entraron, cuáles fueron parciales, dónde (si acaso) se aplicó mora primero, y cómo eso llevó al conteo por dinero.
- Si alguna verificación falló, dilo con claridad y señala qué número no cuadra.
- Sé conciso: 1 párrafo de resumen + viñetas si ayuda. No repitas el JSON.`;

function facts(snapshot: LoanSnapshot, report: EvalReport): string {
  const d = snapshot.derived;
  const t = snapshot.terms;
  const rationales = COLLECTIONS_CHECKS.map((c) => `- ${c.id}: ${c.rationale}`).join("\n");
  const ledger = snapshot.ledger
    .map(
      (l) =>
        `  ${l.paidAt.slice(0, 10)} ${l.kind} ${l.status} RD$${l.amount}${
          l.countsTowardCuotas ? " (cuenta)" : ""
        }`
    )
    .join("\n");
  const checks = report.results
    .map((r) => `- ${r.pass ? "OK " : "FALLA"} ${r.id}: esperado ${r.expected}; real ${r.actual}`)
    .join("\n");

  return `PRÉSTAMO #${snapshot.loanId} — ${snapshot.customer.nickname ?? snapshot.customer.name}
Términos: cuota RD$${t.cuota}, plazo ${t.termLength}, frecuencia ${t.paymentFrequency}, estado ${t.status}, mora ${t.moraPolicy.moraRate}.
Números derivados (autoritativos, NO recalcular):
- cuotas cubiertas: ${d.cuotasCovered} de ${d.termLength}
- pagos pendientes: ${d.pendingPayments}
- total abonado a cuotas: RD$${d.totalInstallmentPaid}
- saldo restante: RD$${d.remainingBalance}
- mora neta: RD$${d.moraAccrued} (bruta RD$${d.grossMora}, cobrada RD$${d.collectedMora})
- ciclos vencidos sin pagar: ${d.missedCycles}, días de atraso: ${d.daysLate}
- próximo vencimiento: ${d.nextDueDate.slice(0, 10)}

Ledger completo (crudo, ordenado):
${ledger}

Resultado de verificaciones:
${checks}

Especificación (por qué existe cada regla):
${rationales}`;
}

function getText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "string"
          ? part
          : part && typeof part === "object" && "text" in part
            ? String((part as { text: unknown }).text)
            : ""
      )
      .join("");
  }
  return "";
}

/** Produce a Spanish narration of how the loan reached its numbers. */
export async function explainLoanHealth(
  model: BaseChatModel,
  snapshot: LoanSnapshot,
  report: EvalReport
): Promise<string> {
  const response = await model.invoke([
    new SystemMessage(SYSTEM_PROMPT),
    new HumanMessage(facts(snapshot, report))
  ]);
  return getText(response.content).trim();
}
