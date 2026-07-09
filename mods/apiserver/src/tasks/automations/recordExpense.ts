/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * record-expense: a generic recurring operating expense (the founder's
 * weekly-gas case). Same shape as payment minus the employee context:
 * concept/account/category are pinned at creation, the amount is asked at
 * confirmation.
 */
import { z } from "zod/v4";
import type { Automation } from "../types.js";

export const recordExpense: Automation = {
  id: "record-expense",
  title: "Registrar gasto",
  gateFloor: "confirm",
  params: {
    concept: {
      label: "Concepto",
      source: "static",
      kind: "text",
      schema: z.string().trim().min(1).max(120)
    },
    accountId: {
      label: "Cuenta",
      source: "static",
      kind: "account",
      schema: z.uuid()
    },
    categoryId: {
      label: "Categoría",
      source: "static",
      kind: "category",
      schema: z.uuid()
    },
    amount: {
      label: "Monto (RD$)",
      source: "ask",
      kind: "amount",
      schema: z.coerce.number().positive().max(500_000)
    },
    note: {
      label: "Nota (opcional)",
      source: "ask",
      kind: "text",
      schema: z.string().max(300).optional(),
      optional: true
    }
  },
  async execute(payload, deps) {
    const amount = payload.amount as number;
    const concept = payload.concept as string;

    await deps.createTransaction({
      type: "EXPENSE",
      amount,
      occurredAt: new Date(),
      description: (payload.note as string | undefined) || concept,
      accountId: payload.accountId as string,
      categoryId: payload.categoryId as string,
      createdById: deps.actorId
    });

    return {
      summary: `Gasto "${concept}" de RD$${amount.toLocaleString("es-DO")} registrado.`,
      amount
    };
  }
};
