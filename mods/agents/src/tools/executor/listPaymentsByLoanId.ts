/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

export async function handleListPaymentsByLoanId(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>
): Promise<ToolResult> {
  // Parse numeric loanId from string
  const loanIdInput = args.loanId as string;
  const numericLoanId = Number(loanIdInput);
  if (isNaN(numericLoanId) || numericLoanId <= 0) {
    return {
      success: false,
      message: `ID de préstamo inválido: ${loanIdInput}. Debe ser un número positivo (ej: 10000, 10001).`
    };
  }

  // Parse limit if provided
  const limit = args.limit ? Number(args.limit) : undefined;
  if (limit !== undefined && (isNaN(limit) || limit <= 0 || limit > 100)) {
    return {
      success: false,
      message: `Límite inválido: ${args.limit}. Debe ser un número entre 1 y 100.`
    };
  }

  const payments = await deps.listPaymentsByLoanId({
    loanId: numericLoanId,
    limit: limit || 10 // Default to 10 most recent payments
  });

  logger.verbose("payments listed via tool by loan ID", {
    loanId: numericLoanId,
    count: payments.length
  });

  if (payments.length === 0) {
    return {
      success: true,
      message: `No se encontraron pagos para el préstamo #${numericLoanId}.`,
      data: { payments: [] }
    };
  }

  // Format payment information for display
  const paymentInfo = payments.map((p, index) => {
    const isLast = index === 0;
    return {
      ...p,
      isLastPayment: isLast,
      displayText: `${isLast ? "ÚLTIMO PAGO - " : ""}Monto: RD$ ${Number(p.amount).toLocaleString("es-DO")}, Fecha: ${new Date(p.paidAt).toLocaleDateString("es-DO")}, Estado: ${p.status}`
    };
  });

  const lastPayment = payments[0]; // Most recent payment
  const message =
    payments.length === 1
      ? `Se encontró 1 pago para el préstamo #${numericLoanId}. Último pago: RD$ ${Number(lastPayment.amount).toLocaleString("es-DO")} el ${new Date(lastPayment.paidAt).toLocaleDateString("es-DO")}. ID del pago: ${lastPayment.id}`
      : `Se encontraron ${payments.length} pagos para el préstamo #${numericLoanId}. Último pago: RD$ ${Number(lastPayment.amount).toLocaleString("es-DO")} el ${new Date(lastPayment.paidAt).toLocaleDateString("es-DO")}. ID del último pago: ${lastPayment.id}`;

  return {
    success: true,
    message,
    data: {
      payments: paymentInfo,
      lastPayment: {
        id: lastPayment.id,
        amount: lastPayment.amount,
        paidAt: lastPayment.paidAt,
        status: lastPayment.status,
        method: lastPayment.method
      },
      count: payments.length
    }
  };
}
