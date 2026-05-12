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
  const collectorId = context?.userId as string | undefined;
  if (!collectorId) {
    return {
      success: false,
      message: "Collector ID is required but not available in context"
    };
  }

  const role = context?.role as string | undefined;
  const isAdmin = role === "ADMIN";

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

  if (loan.status !== "ACTIVE") {
    return {
      success: false,
      message: `El préstamo ${numericLoanId} no está activo. Estado actual: ${loan.status}`
    };
  }

  if (!isAdmin) {
    if (!loan.customer.assignedCollectorId) {
      return {
        success: false,
        message: "Este préstamo no tiene un cobrador asignado"
      };
    }

    if (loan.customer.assignedCollectorId !== collectorId) {
      return {
        success: false,
        message:
          "No tienes permiso para registrar pagos para este préstamo. Este préstamo está asignado a otro cobrador."
      };
    }
  }

  const amount = Number(args.amount);
  if (isNaN(amount) || amount <= 0) {
    return {
      success: false,
      message: `Monto de pago inválido: ${args.amount}. Debe ser un número positivo.`
    };
  }

  const result = await deps.createPayment({
    loanId: numericLoanId,
    amount,
    collectedById: collectorId,
    notes: args.notes as string | undefined
  });

  const receiptPaymentId = result.installment?.id ?? result.lateFee?.id;
  if (!receiptPaymentId) {
    return { success: false, message: "No se creó ningún registro de pago" };
  }

  logger.verbose("payment created via tool", {
    installmentId: result.installment?.id,
    lateFeeId: result.lateFee?.id,
    loanId: loan.loanId,
    collectorId
  });

  let receipt;
  try {
    receipt = await deps.generateReceipt({
      paymentId: receiptPaymentId
    });
    logger.verbose("receipt generated via tool", {
      paymentId: receiptPaymentId
    });
  } catch (error) {
    const err = error as Error;
    logger.error("receipt generation failed in createPayment", {
      paymentId: receiptPaymentId,
      error: err.message
    });
    return {
      success: true,
      message: `OK - recibo pendiente, paymentId: ${receiptPaymentId}`,
      data: {
        installmentPaymentId: result.installment?.id,
        lateFeePaymentId: result.lateFee?.id,
        amountInstallment: result.installment?.amount,
        amountLateFee: result.lateFee?.amount,
        loan: {
          loanId: loan.loanId,
          principal: loan.principal,
          termLength: loan.termLength,
          paymentAmount: loan.paymentAmount,
          paymentFrequency: loan.paymentFrequency,
          status: loan.status
        },
        customer: {
          id: loan.customer.id,
          name: loan.customer.name,
          phone: loan.customer.phone
        }
      }
    };
  }

  return {
    success: true,
    message: "OK",
    data: {
      installmentPaymentId: result.installment?.id,
      lateFeePaymentId: result.lateFee?.id,
      amountInstallment: result.installment?.amount,
      amountLateFee: result.lateFee?.amount,
      receiptPaymentId,
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
      customer: {
        id: loan.customer.id,
        name: loan.customer.name,
        phone: loan.customer.phone
      }
    }
  };
}
