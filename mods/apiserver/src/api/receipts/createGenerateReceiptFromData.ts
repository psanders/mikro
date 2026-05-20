/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import {
  getConfig,
  resolvePathFromConfigDir,
  withErrorHandlingAndValidation,
  receiptDataSchema,
  renderReceiptToImage,
  type ReceiptDataInput,
  type ReceiptData
} from "@mikro/common";
import { logger } from "../../logger.js";

function getKeysDir(): string {
  return resolvePathFromConfigDir(getConfig().keysPath);
}

function getAssetsDir(): string {
  return resolvePathFromConfigDir(getConfig().assetsPath);
}

export interface ReceiptFromDataDependencies {
  keysDir?: string;
  assetsDir?: string;
}

/**
 * Creates a function to generate a receipt from raw data (no database).
 * Used by the CLI interactive mode so it doesn't need local assets/keys.
 */
export function createGenerateReceiptFromDataApi(deps: ReceiptFromDataDependencies = {}) {
  const keysDir = deps.keysDir ?? getKeysDir();
  const assetsDir = deps.assetsDir ?? getAssetsDir();

  const fn = async (params: ReceiptDataInput) => {
    logger.verbose("generating receipt from data", { loanNumber: params.loanNumber });

    const receiptData: ReceiptData = {
      loanNumber: params.loanNumber,
      name: params.name,
      date: params.date,
      principalAmount: params.principalAmount,
      amountPaid: params.amountPaid,
      pendingPayments: params.pendingPayments,
      paymentNumber: params.paymentNumber,
      agentName: params.agentName,
      feePaid: params.feePaid,
      totalPaid: params.totalPaid
    };

    return renderReceiptToImage(receiptData, keysDir, assetsDir, logger);
  };

  return withErrorHandlingAndValidation(fn, receiptDataSchema);
}
