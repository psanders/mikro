/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * daily-close: bridges one calendar day's collected loan payments into the
 * accounting ledger — the manual process ACCOUNTING.md documents as awaiting
 * "future automation". Posts one INCOME deposit per payment method to the
 * configured account. Idempotent per close date via the transaction
 * `reference` marker `daily-close:<date>`: a date already bridged refuses
 * (surfaced as task.failed), never double-posts. A day with no collections
 * completes successfully without posting.
 */
import { z } from "zod/v4";
import { amountToNumber } from "@mikro/common";
import type { Automation, ResolveContext } from "../types.js";
import { localDateString, localDayRange } from "../dates.js";

const METHOD_LABELS: Record<string, string> = {
  CASH: "efectivo",
  TRANSFER: "transferencia",
  CARD: "tarjeta",
  OTHER: "otro"
};

function referenceFor(closeDate: string): string {
  return `daily-close:${closeDate}`;
}

/**
 * The Santo Domingo calendar day of the firing's due day itself. Safe as
 * same-day close because collections cut off at 5PM and this task fires at
 * 7PM — a 2-hour buffer, so nothing more lands in the window being closed.
 */
async function resolveCloseDate(ctx: ResolveContext): Promise<string> {
  return localDateString(ctx.dueAt);
}

export const dailyClose: Automation = {
  id: "daily-close",
  title: "Cierre contable del día",
  gateFloor: "confirm",
  params: {
    accountId: {
      label: "Cuenta destino",
      source: "static",
      kind: "account",
      schema: z.uuid()
    },
    closeDate: {
      label: "Fecha a cerrar",
      source: "computed",
      kind: "text",
      schema: z.iso.date(),
      resolve: resolveCloseDate
    }
  },
  async buildContext(ctx) {
    const closeDate = await resolveCloseDate(ctx);
    const { start, end } = localDayRange(closeDate);
    const payments = await ctx.db.payment.findMany({
      where: { paidAt: { gte: start, lt: end }, status: { not: "REVERSED" } },
      select: { amount: true }
    });
    return {
      closeDate,
      dayCollected: payments.reduce((sum, p) => sum + amountToNumber(p.amount), 0),
      dayPayments: payments.length
    };
  },
  async execute(payload, deps) {
    const closeDate = payload.closeDate as string;
    const accountId = payload.accountId as string;
    const reference = referenceFor(closeDate);

    const existing = await deps.db.accountingTransaction.findFirst({
      where: { reference: { startsWith: reference } },
      select: { id: true }
    });
    if (existing) {
      throw new Error(`El día ${closeDate} ya fue cerrado (transacción ${existing.id}).`);
    }

    const { start, end } = localDayRange(closeDate);
    const payments = await deps.db.payment.findMany({
      where: { paidAt: { gte: start, lt: end }, status: { not: "REVERSED" } },
      select: { amount: true, method: true }
    });

    if (payments.length === 0) {
      return { summary: `Cierre del ${closeDate}: sin cobranza, nada que depositar.` };
    }

    const byMethod = new Map<string, number>();
    for (const p of payments) {
      byMethod.set(p.method, (byMethod.get(p.method) ?? 0) + amountToNumber(p.amount));
    }

    let total = 0;
    for (const [method, amount] of byMethod) {
      total += amount;
      await deps.createTransaction({
        type: "INCOME",
        amount,
        occurredAt: end,
        description: `Cierre diario ${closeDate} — cobranza en ${METHOD_LABELS[method] ?? method}`,
        reference: `${reference}:${method}`,
        accountId,
        createdById: deps.actorId
      });
    }

    return {
      summary: `Cierre del ${closeDate}: RD$${total.toLocaleString("es-DO")} depositados (${payments.length} pagos, ${byMethod.size} método(s)).`,
      amount: total
    };
  }
};
