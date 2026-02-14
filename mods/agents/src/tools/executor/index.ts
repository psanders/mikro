/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Tool executor that delegates tool calls to API functions.
 */
import type { ToolResult, ToolExecutor } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";
import { handleCreateMember } from "./createMember.js";
import { handleCreatePayment } from "./createPayment.js";
import { handleSendReceiptViaWhatsApp } from "./sendReceiptViaWhatsApp.js";
import { handleListPaymentsByLoanId } from "./listPaymentsByLoanId.js";
import { handleListLoansByCollector } from "./listLoansByCollector.js";
import { handleGetMember } from "./getMember.js";
import { handleCreateLoan } from "./createLoan.js";
import { handleUpdateLoanStatus } from "./updateLoanStatus.js";
import { handleGetMemberByPhone } from "./getMemberByPhone.js";
import { handleListLoansByMember } from "./listLoansByMember.js";
import { handleListMemberLoansByPhone } from "./listMemberLoansByPhone.js";
import { handleListUsers } from "./listUsers.js";
import { handleGetLoanByLoanId } from "./getLoanByLoanId.js";
import { handleExportCollectorMembers } from "./exportCollectorMembers.js";
import { handleExportMembersByReferrer } from "./exportMembersByReferrer.js";
import { handleExportAllMembers } from "./exportAllMembers.js";
import { handleGeneratePerformanceReport } from "./handleGeneratePerformanceReport.js";

/**
 * Creates a tool executor that delegates to the provided API functions.
 *
 * @param deps - The API functions to use for tool execution
 * @returns A ToolExecutor function
 *
 * @example
 * ```typescript
 * const toolExecutor = createToolExecutor({
 *   createMember: createCreateMember(db),
 *   createPayment: createCreatePayment(db),
 *   // ... other API functions
 * });
 *
 * const result = await toolExecutor("createMember", { name: "John" }, { phone: "+123" });
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
    createMember: handleCreateMember,
    createPayment: handleCreatePayment,
    sendReceiptViaWhatsApp: handleSendReceiptViaWhatsApp,
    listPaymentsByLoanId: handleListPaymentsByLoanId,
    listLoansByCollector: handleListLoansByCollector,
    getMember: handleGetMember,
    createLoan: handleCreateLoan,
    updateLoanStatus: handleUpdateLoanStatus,
    getMemberByPhone: handleGetMemberByPhone,
    listLoansByMember: handleListLoansByMember,
    listMemberLoansByPhone: handleListMemberLoansByPhone,
    listUsers: handleListUsers,
    getLoanByLoanId: handleGetLoanByLoanId,
    exportCollectorMembers: handleExportCollectorMembers,
    exportMembersByReferrer: handleExportMembersByReferrer,
    exportAllMembers: handleExportAllMembers,
    generatePerformanceReport: handleGeneratePerformanceReport
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
export type { ToolExecutorDependencies } from "./types.js";
