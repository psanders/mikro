/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * pay-collector: the founder's recurring collector payment. Static slots pin
 * who and from which account/category at task-creation time; the amount is an
 * ask slot (the commission formula is not encoded yet — design non-goal), and
 * the card shows the collector's trailing-week collections as display-only
 * context so the founder decides with the number in front of them.
 */
import { z } from "zod/v4";
import { amountToNumber } from "@mikro/common";
import type { Automation, ResolveContext } from "../types.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

async function weekContext(ctx: ResolveContext): Promise<Record<string, unknown>> {
  const collectorId = ctx.staticParams.collectorId as string;
  const [collector, payments] = await Promise.all([
    ctx.db.user.findUnique({ where: { id: collectorId }, select: { name: true } }),
    ctx.db.payment.findMany({
      where: {
        collectedById: collectorId,
        paidAt: { gte: new Date(ctx.dueAt.getTime() - WEEK_MS), lte: ctx.dueAt },
        status: { not: "REVERSED" }
      },
      select: { amount: true }
    })
  ]);

  return {
    collectorName: collector?.name ?? "(cobrador)",
    weekCollected: payments.reduce((sum, p) => sum + amountToNumber(p.amount), 0),
    weekPayments: payments.length
  };
}

export const payCollector: Automation = {
  id: "pay-collector",
  title: "Pagar cobrador",
  gateFloor: "confirm",
  params: {
    collectorId: {
      label: "Cobrador",
      source: "static",
      kind: "collector",
      schema: z.uuid()
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
  buildContext: weekContext,
  async execute(payload, deps) {
    const amount = payload.amount as number;
    const collector = await deps.db.user.findUnique({
      where: { id: payload.collectorId as string },
      select: { name: true }
    });
    const collectorName = collector?.name ?? "(cobrador)";

    await deps.createTransaction({
      type: "EXPENSE",
      amount,
      occurredAt: new Date(),
      description: (payload.note as string | undefined) || `Pago a cobrador ${collectorName}`,
      accountId: payload.accountId as string,
      categoryId: payload.categoryId as string,
      createdById: deps.actorId
    });

    return {
      summary: `Pago de RD$${amount.toLocaleString("es-DO")} a ${collectorName} registrado.`,
      amount
    };
  }
};
