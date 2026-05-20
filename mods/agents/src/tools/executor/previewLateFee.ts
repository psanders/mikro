/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

export async function handlePreviewLateFee(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const loanIdInput = args.loanId as string;
  const numericLoanId = Number(loanIdInput);
  if (isNaN(numericLoanId) || numericLoanId <= 0) {
    return {
      success: false,
      message: `ID de préstamo inválido: ${loanIdInput}. Debe ser un número positivo (ej: 10000, 10001).`
    };
  }

  const asOfStr = args.asOf as string | undefined;
  let asOf: Date | undefined;
  if (asOfStr) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(asOfStr.trim());
    if (!m) {
      return {
        success: false,
        message: `Fecha inválida: ${asOfStr}. Usa formato YYYY-MM-DD.`
      };
    }
    asOf = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0, 0);
  }

  const preview = await deps.previewLateFee({
    loanId: numericLoanId,
    ...(asOf ? { asOf } : {})
  });

  logger.verbose("mora preview via tool", {
    loanId: numericLoanId,
    accruedMora: preview.accruedMora,
    daysLate: preview.daysLate
  });

  const fmt = (n: number) => `RD$ ${Number(n).toLocaleString("es-DO")}`;

  return {
    success: true,
    message:
      `Mora préstamo #${numericLoanId}: cuota ${fmt(preview.cuota)}, mora bruta ${fmt(preview.grossMora)}, ` +
      `ya cobrada ${fmt(preview.collectedMora)}, mora neta ${fmt(preview.accruedMora)} ` +
      `(${preview.daysLate} días, ${preview.missedCycles} ciclos atrasados). ` +
      `Total sugerido: ${fmt(preview.suggestedTotal)}.`,
    data: { preview }
  };
}
