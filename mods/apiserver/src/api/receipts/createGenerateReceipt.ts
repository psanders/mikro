/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  getConfig,
  resolvePathFromConfigDir,
  withErrorHandlingAndValidation,
  generateReceiptSchema,
  renderReceiptToImage,
  type GenerateReceiptInput,
  type DbClient,
  type ReceiptData
} from "@mikro/common";
import { logger } from "../../logger.js";

function getKeysDir(): string {
  return resolvePathFromConfigDir(getConfig().keysPath);
}

function getAssetsDir(): string {
  return resolvePathFromConfigDir(getConfig().assetsPath);
}

/**
 * Response from generateReceipt. Re-exported for backward compatibility.
 */
export type { GenerateReceiptResponse } from "@mikro/common";

/**
 * Dependencies for receipt generation.
 */
export interface ReceiptDependencies {
  db: DbClient;
  keysDir?: string;
  assetsDir?: string;
}

/**
 * Creates a function to generate a payment receipt as a PNG image.
 *
 * @param deps - Dependencies including database client and optional directories
 * @returns A validated function that generates a receipt
 */
export function createGenerateReceipt(deps: ReceiptDependencies) {
  const keysDir = deps.keysDir ?? getKeysDir();
  const assetsDir = deps.assetsDir ?? getAssetsDir();

  const fn = async (params: GenerateReceiptInput) => {
    logger.verbose("generating receipt", { paymentId: params.paymentId });

    const payment = await deps.db.payment.findUnique({
      where: { id: params.paymentId },
      include: {
        loan: {
          include: {
            customer: true,
            payments: {
              where: { status: { in: ["COMPLETED", "PARTIAL"] } },
              orderBy: { paidAt: "asc" }
            }
          }
        },
        collectedBy: true
      }
    });

    if (!payment) {
      throw new Error(`Payment not found: ${params.paymentId}`);
    }

    const { loan } = payment;
    const { customer, payments: allPayments } = loan;

    const completedPayments = allPayments.filter((p) => p.status === "COMPLETED");
    const completedIndex = completedPayments.findIndex((p) => p.id === payment.id);
    const completedPaymentNumber =
      completedIndex >= 0 ? completedIndex + 1 : completedPayments.length;
    const pendingPayments = Math.max(0, loan.termLength - completedPayments.length);

    const receiptData: ReceiptData = {
      loanNumber: String(loan.loanId),
      name: loan.nickname ?? customer.name,
      date: payment.paidAt.toLocaleDateString("es-DO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }),
      amountPaid: `RD$ ${Number(payment.amount).toLocaleString("es-DO")}`,
      pendingPayments: Math.max(0, pendingPayments),
      paymentNumber: payment.status === "PARTIAL" ? "Parcial" : `P${completedPaymentNumber}`,
      agentName: payment.collectedBy?.name
    };

    return renderReceiptToImage(receiptData, keysDir, assetsDir, logger);
  };

  return withErrorHandlingAndValidation(fn, generateReceiptSchema);
}
