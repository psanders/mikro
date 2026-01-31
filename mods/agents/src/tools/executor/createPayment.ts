/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

export async function handleCreatePayment(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<ToolResult> {
  // Get collector ID from context
  const collectorId = context?.userId as string | undefined;
  if (!collectorId) {
    return {
      success: false,
      message: "Collector ID is required but not available in context"
    };
  }

  const role = context?.role as string | undefined;
  const isAdmin = role === "ADMIN";

  // Parse numeric loanId from string (e.g., "10000" -> 10000)
  const loanIdInput = args.loanId as string;
  const numericLoanId = Number(loanIdInput);
  if (isNaN(numericLoanId) || numericLoanId <= 0) {
    return {
      success: false,
      message: `ID de préstamo inválido: ${loanIdInput}. Debe ser un número positivo (ej: 10000, 10001).`
    };
  }

  // Get loan by numeric loanId (includes member with assignedCollectorId)
  const loan = await deps.getLoanByLoanId({
    loanId: numericLoanId
  });

  if (!loan) {
    return {
      success: false,
      message: `Préstamo no encontrado con ID: ${numericLoanId}`
    };
  }

  // Validate loan is active
  if (loan.status !== "ACTIVE") {
    return {
      success: false,
      message: `El préstamo ${numericLoanId} no está activo. Estado actual: ${loan.status}`
    };
  }

  // Skip collector validation for admins
  if (!isAdmin) {
    if (!loan.member.assignedCollectorId) {
      return {
        success: false,
        message: "Este préstamo no tiene un cobrador asignado"
      };
    }

    if (loan.member.assignedCollectorId !== collectorId) {
      return {
        success: false,
        message:
          "No tienes permiso para registrar pagos para este préstamo. Este préstamo está asignado a otro cobrador."
      };
    }
  }

  // Parse payment amount
  const amount = Number(args.amount);
  if (isNaN(amount) || amount <= 0) {
    return {
      success: false,
      message: `Monto de pago inválido: ${args.amount}. Debe ser un número positivo.`
    };
  }

  // Create payment using numeric loanId - createPayment will handle UUID conversion internally
  const payment = await deps.createPayment({
    loanId: numericLoanId, // Numeric loanId - createPayment converts to UUID internally
    amount,
    collectedById: collectorId,
    notes: args.notes as string | undefined
  });

  logger.verbose("payment created via tool", {
    paymentId: payment.id,
    loanId: loan.loanId,
    collectorId
  });

  // Generate receipt
  let receipt;
  try {
    receipt = await deps.generateReceipt({
      paymentId: payment.id
    });
    logger.verbose("receipt generated via tool", {
      paymentId: payment.id
    });
  } catch (error) {
    const err = error as Error;
    logger.error("receipt generation failed in createPayment", {
      paymentId: payment.id,
      error: err.message
    });
    // Payment was created, but receipt generation failed - keep message minimal
    return {
      success: true,
      message: `OK - recibo pendiente, paymentId: ${payment.id}`,
      data: {
        paymentId: payment.id,
        amount: payment.amount,
        loan: {
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
          phone: loan.member.phone
        }
      }
    };
  }

  // Format success message - keep minimal so LLM doesn't elaborate
  const successMessage = `OK`;

  return {
    success: true,
    message: successMessage,
    data: {
      paymentId: payment.id,
      amount: payment.amount,
      receipt: {
        image: receipt.image,
        token: receipt.token
      },
      loan: {
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
        phone: loan.member.phone
      }
    }
  };
}
