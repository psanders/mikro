/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";

const TRANSACTION_TYPES = new Set(["DEPOSIT", "WITHDRAWAL", "EXPENSE", "INCOME", "TRANSFER"]);

export async function handleCreateAccountingTransaction(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<ToolResult> {
  if (!deps.createAccountingTransaction) {
    return { success: false, message: "createAccountingTransaction no está configurada." };
  }

  const createdById = context?.userId as string | undefined;
  if (!createdById) {
    return { success: false, message: "No se pudo identificar al usuario que confirma." };
  }

  const type = String(args.type ?? "");
  if (!TRANSACTION_TYPES.has(type)) {
    return { success: false, message: `Tipo de transacción inválido: "${String(args.type)}".` };
  }

  const account = typeof args.account === "string" ? args.account.trim() : "";
  if (!account) {
    return { success: false, message: "Falta la cuenta de origen." };
  }

  const amount = Number(args.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return { success: false, message: `Monto inválido: "${String(args.amount)}".` };
  }

  let occurredAt: Date | undefined;
  if (args.occurredAt != null && args.occurredAt !== "") {
    const parsed = new Date(String(args.occurredAt));
    if (Number.isNaN(parsed.getTime())) {
      return {
        success: false,
        message: `Fecha inválida: "${String(args.occurredAt)}". Use formato YYYY-MM-DD.`
      };
    }
    occurredAt = parsed;
  }

  try {
    const txn = await deps.createAccountingTransaction(
      {
        type: type as "DEPOSIT" | "WITHDRAWAL" | "EXPENSE" | "INCOME" | "TRANSFER",
        account,
        toAccount: typeof args.toAccount === "string" ? args.toAccount.trim() : undefined,
        amount,
        category: typeof args.category === "string" ? args.category.trim() : undefined,
        description: typeof args.description === "string" ? args.description : undefined,
        vendor: typeof args.vendor === "string" ? args.vendor : undefined,
        reference: typeof args.reference === "string" ? args.reference : undefined,
        occurredAt
      },
      createdById
    );

    logger.verbose("accounting transaction created via tool", { id: txn.id, type: txn.type });
    return {
      success: true,
      message: `Transacción registrada: ${txn.type} de RD$${txn.amount} en ${txn.account}.`,
      data: { ...txn }
    };
  } catch (error) {
    return { success: false, message: (error as Error).message };
  }
}
