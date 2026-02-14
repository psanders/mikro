/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

export async function handleRunSingleCollection(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const loanId = Number(args.loanId);
  if (!Number.isInteger(loanId) || loanId <= 0) {
    return {
      success: false,
      message: "loanId debe ser un número de préstamo válido (ej: 10019)."
    };
  }
  const channel = args.channel as "WHATSAPP" | "PHONE_CALL" | undefined;
  const type = args.type as "PAYMENT_REMINDER" | "OVERDUE_NOTICE" | "COLLECTION_CALL" | undefined;

  const result = await deps.runSingleCollection({
    loanId,
    channel,
    type,
    dryRun: false
  });

  logger.verbose("single collection run via tool", {
    loanId: result.loanId,
    type: result.type,
    channel: result.channel,
    success: result.success
  });

  if (!result.success) {
    return {
      success: false,
      message: result.error ?? "No se pudo enviar la acción de cobro."
    };
  }

  const actionLabel =
    result.type === "PAYMENT_REMINDER"
      ? "recordatorio de pago"
      : result.type === "OVERDUE_NOTICE"
        ? "aviso de mora"
        : "llamada de cobro";
  return {
    success: true,
    message: result.dryRun
      ? `Dry run: se habría enviado ${actionLabel} por ${result.channel} a ${result.memberName} (préstamo #${result.loanId}).`
      : `Listo. Enviado ${actionLabel} por ${result.channel} a ${result.memberName} (préstamo #${result.loanId}).`,
    data: {
      loanId: result.loanId,
      type: result.type,
      channel: result.channel,
      memberName: result.memberName,
      dryRun: result.dryRun
    }
  };
}
