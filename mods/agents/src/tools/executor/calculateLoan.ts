/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";

function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

export async function handleCalculateLoan(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>
): Promise<ToolResult> {
  const result = await deps.calculateLoan({
    principal: Number(args.principal),
    interestRate: Number(args.interestRate),
    paymentFrequency: args.paymentFrequency as "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY",
    baseDuration: Number(args.baseDuration),
    adjustmentPerPeriod: args.adjustmentPerPeriod ? Number(args.adjustmentPerPeriod) : undefined
  });

  const lines = result.options.map((option) => {
    const marker = option.isBase ? " (base)" : "";
    return `${option.duration} ${option.paymentFrequency.toLowerCase()}${marker}: RD$ ${option.paymentPerPeriod} por periodo, interés ${formatPercent(option.interestRate)}, total RD$ ${option.totalRepay.toFixed(2)}`;
  });

  return {
    success: true,
    message: `Opciones calculadas para RD$ ${result.principal.toFixed(2)}:\n${lines.join("\n")}`,
    data: result
  };
}
