/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Tool executor that delegates tool calls to API functions.
 */
import type { ToolResult, ToolExecutor } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";
import { handleCreateCustomer } from "./createCustomer.js";
import { handleCreatePayment } from "./createPayment.js";
import { handleSendReceiptViaWhatsApp } from "./sendReceiptViaWhatsApp.js";
import { handleListPaymentsByLoanId } from "./listPaymentsByLoanId.js";
import { handleListLoansByCollector } from "./listLoansByCollector.js";
import { handleGetCustomer } from "./getCustomer.js";
import { handleCreateLoan } from "./createLoan.js";
import { handleUpdateLoanStatus } from "./updateLoanStatus.js";
import { handleSendPromo } from "./sendPromo.js";
import { handleCalculateLoan } from "./calculateLoan.js";
import { handleGetCustomerByPhone } from "./getCustomerByPhone.js";
import { handleListLoansByCustomer } from "./listLoansByCustomer.js";
import { handleListCustomerLoansByPhone } from "./listCustomerLoansByPhone.js";
import { handleListUsers } from "./listUsers.js";
import { handleGetLoanByLoanId } from "./getLoanByLoanId.js";
import { handlePreviewLateFee } from "./previewLateFee.js";
import { handleExportCollectorCustomers } from "./exportCollectorCustomers.js";
import { handleExportAllCustomers } from "./exportAllCustomers.js";
import { handleGeneratePerformanceReport } from "./handleGeneratePerformanceReport.js";
import { handleGenerateDefaultedReport } from "./handleGenerateDefaultedReport.js";
import { handleGenerateRenewalCandidatesReport } from "./handleGenerateRenewalCandidatesReport.js";

/**
 * Creates a tool executor that delegates to the provided API functions.
 *
 * @param deps - The API functions to use for tool execution
 * @returns A ToolExecutor function
 *
 * @example
 * ```typescript
 * const toolExecutor = createToolExecutor({
 *   createCustomer: createCreateCustomer(db),
 *   createPayment: createCreatePayment(db),
 *   // ... other API functions
 * });
 *
 * const result = await toolExecutor("createCustomer", { name: "John" }, { phone: "+123" });
 * ```
 */
export function createToolExecutor(deps: ToolExecutorDependencies): ToolExecutor {
  const handlers: Record<
    string,
    (
      deps: ToolExecutorDependencies,
      args: Record<string, unknown>,
      context?: Record<string, unknown>
    ) => Promise<ToolResult>
  > = {
    createCustomer: handleCreateCustomer,
    createPayment: handleCreatePayment,
    sendReceiptViaWhatsApp: handleSendReceiptViaWhatsApp,
    listPaymentsByLoanId: handleListPaymentsByLoanId,
    listLoansByCollector: handleListLoansByCollector,
    getCustomer: handleGetCustomer,
    createLoan: handleCreateLoan,
    calculateLoan: handleCalculateLoan,
    updateLoanStatus: handleUpdateLoanStatus,
    sendPromo: handleSendPromo,
    getCustomerByPhone: handleGetCustomerByPhone,
    listLoansByCustomer: handleListLoansByCustomer,
    listCustomerLoansByPhone: handleListCustomerLoansByPhone,
    listUsers: handleListUsers,
    getLoanByLoanId: handleGetLoanByLoanId,
    previewLateFee: handlePreviewLateFee,
    exportCollectorCustomers: handleExportCollectorCustomers,
    exportAllCustomers: handleExportAllCustomers,
    generatePerformanceReport: handleGeneratePerformanceReport,
    generateDefaultedReport: handleGenerateDefaultedReport,
    generateRenewalCandidatesReport: handleGenerateRenewalCandidatesReport,
    getApplicationState: async (d, _args, ctx) => {
      if (!d.joseGetApplicationState)
        return { success: false, message: "getApplicationState not configured" };
      return d.joseGetApplicationState(ctx);
    },
    saveAnswer: async (d, args, ctx) => {
      if (!d.joseSaveAnswer) return { success: false, message: "saveAnswer not configured" };
      return d.joseSaveAnswer(args, ctx);
    },
    finalizeApplication: async (d, args, ctx) => {
      if (!d.joseFinalizeApplication)
        return { success: false, message: "finalizeApplication not configured" };
      return d.joseFinalizeApplication(args, ctx);
    }
  };

  return async function executeTool(
    toolName: string,
    args: Record<string, unknown>,
    context?: Record<string, unknown>
  ): Promise<ToolResult> {
    logger.verbose("executing tool", { tool: toolName, args });

    try {
      const handler = handlers[toolName];
      if (handler) {
        return await handler(deps, args, context);
      }

      logger.warn("unknown tool called", { tool: toolName });
      return {
        success: false,
        message: `Herramienta desconocida: ${toolName}`
      };
    } catch (error) {
      const err = error as Error;
      logger.error("tool execution failed", { tool: toolName, error: err.message });
      return {
        success: false,
        message: `Error al ejecutar ${toolName}: ${err.message}`
      };
    }
  };
}

// Re-export types for convenience
export type { ToolExecutorDependencies, ExportedCustomer, ExportedLoan } from "./types.js";
