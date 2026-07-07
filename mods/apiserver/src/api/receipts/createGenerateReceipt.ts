/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  getConfig,
  resolvePathFromConfigDir,
  withErrorHandlingAndValidation,
  generateReceiptSchema,
  renderReceiptToImage,
  renderReceiptCardToImage,
  formatMoney,
  amountToNumber,
  countCuotasCovered,
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
  /**
   * Layout to render. "thermal" (default) is the 384px printer slip sent to the
   * collector; "card" is the 1125×600 landscape image used as the WhatsApp
   * payment-confirmation template header.
   */
  variant?: "thermal" | "card";
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
  const variant = deps.variant ?? "thermal";

  const fn = async (params: GenerateReceiptInput) => {
    logger.verbose("generating receipt", { paymentId: params.paymentId });

    const payment = await deps.db.payment.findUnique({
      where: { id: params.paymentId },
      include: {
        linkedLateFee: true,
        loan: {
          include: {
            customer: true,
            payments: {
              where: { status: { in: ["COMPLETED", "PARTIAL"] }, kind: "INSTALLMENT" },
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

    // Progress is money-based: partial payments accumulate toward cuotas.
    // Count cuotas covered through THIS payment so historical
    // receipts reflect their moment even when regenerated later.
    const cuota = amountToNumber(loan.paymentAmount);
    const rowIndex = allPayments.findIndex((p) => p.id === payment.id);
    const rowsThrough =
      rowIndex >= 0
        ? allPayments.slice(0, rowIndex + 1)
        : // LATE_FEE receipts: the fee row is not in the installment list;
          // count installments up to the fee's timestamp.
          allPayments.filter((p) => p.paidAt <= payment.paidAt);
    const paidThrough = rowsThrough.reduce((sum, p) => sum + amountToNumber(p.amount), 0);
    const cuotasAfter = countCuotasCovered(paidThrough, cuota);
    const cuotasBefore = countCuotasCovered(paidThrough - amountToNumber(payment.amount), cuota);
    const completesCuota = cuotasAfter > cuotasBefore;
    const pendingPayments = Math.max(0, loan.termLength - cuotasAfter);

    const kind = (payment.kind as string | undefined) ?? "INSTALLMENT";
    const linkedFee = payment.linkedLateFee as { amount: unknown } | null | undefined;
    const feeAmount =
      kind === "INSTALLMENT" && linkedFee != null ? amountToNumber(linkedFee.amount) : 0;

    const paymentAmountNum = amountToNumber(payment.amount);
    const installmentDisplay = kind === "LATE_FEE" ? 0 : paymentAmountNum;
    const moraOnlyDisplay = kind === "LATE_FEE" ? paymentAmountNum : 0;

    const receiptData: ReceiptData = {
      loanNumber: String(loan.loanId),
      name: loan.nickname ?? customer.name,
      date: payment.paidAt.toLocaleDateString("es-DO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }),
      principalAmount: `RD$ ${formatMoney(amountToNumber(loan.principal))}`,
      amountPaid: kind === "LATE_FEE" ? undefined : `RD$ ${formatMoney(installmentDisplay)}`,
      pendingPayments: Math.max(0, pendingPayments),
      paymentNumber: kind === "LATE_FEE" ? "Mora" : completesCuota ? `P${cuotasAfter}` : "Parcial",
      agentName: payment.collectedBy?.name,
      feePaid:
        kind === "LATE_FEE"
          ? `RD$ ${formatMoney(moraOnlyDisplay)}`
          : feeAmount > 0
            ? `RD$ ${formatMoney(feeAmount)}`
            : undefined,
      totalPaid:
        feeAmount > 0 && kind === "INSTALLMENT"
          ? `RD$ ${formatMoney(installmentDisplay + feeAmount)}`
          : undefined
    };

    return variant === "card"
      ? renderReceiptCardToImage(receiptData, keysDir, logger)
      : renderReceiptToImage(receiptData, keysDir, assetsDir, logger);
  };

  return withErrorHandlingAndValidation(fn, generateReceiptSchema);
}
