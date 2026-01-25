/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

export async function handleGetLoanByLoanId(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>
): Promise<ToolResult> {
  // Parse numeric loanId from string (e.g., "10000" -> 10000)
  const loanIdInput = args.loanId as string;
  const numericLoanId = Number(loanIdInput);
  if (isNaN(numericLoanId) || numericLoanId <= 0) {
    return {
      success: false,
      message: `ID de préstamo inválido: ${loanIdInput}. Debe ser un número positivo (ej: 10000, 10001).`
    };
  }

  const loan = await deps.getLoanByLoanId({
    loanId: numericLoanId
  });

  if (!loan) {
    return {
      success: false,
      message: `Préstamo no encontrado con ID: ${numericLoanId}`
    };
  }

  logger.verbose("loan retrieved via tool by loan ID", {
    loanId: loan.loanId,
    memberId: loan.member.id
  });

  return {
    success: true,
    message: `Información del préstamo obtenida.`,
    data: {
      loan: {
        id: loan.id,
        loanId: loan.loanId,
        principal: loan.principal,
        termLength: loan.termLength,
        paymentAmount: loan.paymentAmount,
        paymentFrequency: loan.paymentFrequency,
        status: loan.status
      },
      member: {
        id: loan.member.id,
        name: loan.member.name,
        phone: loan.member.phone,
        assignedCollectorId: loan.member.assignedCollectorId
      }
    }
  };
}
