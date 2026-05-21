/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

export async function handleCreateLoan(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>
): Promise<ToolResult> {
  let startingDate: Date | undefined;
  if (args.startingDate != null && args.startingDate !== "") {
    const raw = args.startingDate as string | number | Date;
    const parsed = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      return {
        success: false,
        message: `Fecha de inicio inválida: "${String(args.startingDate)}". Use formato YYYY-MM-DD.`
      };
    }
    startingDate = parsed;
  }
  const loan = await deps.createLoan({
    customerId: args.customerId as string,
    principal: Number(args.principal),
    termLength: Number(args.termLength),
    paymentAmount: Number(args.paymentAmount),
    paymentFrequency: args.paymentFrequency as "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY",
    startingDate
  });

  logger.verbose("loan created via tool", { loanId: loan.loanId });
  return {
    success: true,
    message: `Préstamo creado con número ${loan.loanId}.`,
    data: { loanId: loan.loanId, id: loan.id }
  };
}
