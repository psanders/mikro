/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * payment (issue #163: generalized from the old "pay-collector" — id and
 * `collectorId` param renamed; migration 20260708210000 backfills any Task/
 * TaskFiring row created in the two days pay-collector was live). Account/
 * category are still pinned at creation; the employee is now an optional
 * static slot (free-standing payments — salaries, providers — don't need
 * one), and a static `suggestedAmount` may pre-fill the ask-time amount
 * input without pinning it. The trailing-week collections context only
 * applies when the configured employee actually holds the COLLECTOR role —
 * it degrades to no context otherwise, so a salary/vendor payment never
 * renders a nonsensical "cobró RD$0.00" sentence.
 */
import { z } from "zod/v4";
import { amountToNumber } from "@mikro/common";
import type { Automation, ResolveContext } from "../types.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

async function weekContext(ctx: ResolveContext): Promise<Record<string, unknown>> {
  const employeeId = ctx.staticParams.employeeId as string | undefined;
  if (!employeeId) return {};

  // The trailing-week "cobró" (collected) wording only makes sense for an
  // actual collector — a salary/vendor payment to any other employee has no
  // Payment rows to summarize, so skip the context rather than render a
  // misleading "Esta semana <accountant> cobró RD$0.00" sentence.
  const employee = await ctx.db.user.findUnique({
    where: { id: employeeId },
    select: { name: true, roles: { where: { role: "COLLECTOR" }, select: { role: true } } }
  });
  if (!employee || employee.roles.length === 0) return {};

  const payments = await ctx.db.payment.findMany({
    where: {
      collectedById: employeeId,
      paidAt: { gte: new Date(ctx.dueAt.getTime() - WEEK_MS), lte: ctx.dueAt },
      status: { not: "REVERSED" }
    },
    select: { amount: true }
  });

  return {
    collectorName: employee.name,
    weekCollected: payments.reduce((sum, p) => sum + amountToNumber(p.amount), 0),
    weekPayments: payments.length
  };
}

export const payment: Automation = {
  id: "payment",
  title: "Pago",
  gateFloor: "confirm",
  params: {
    employeeId: {
      label: "Empleado",
      source: "static",
      kind: "collector",
      schema: z.uuid().optional(),
      optional: true
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
    suggestedAmount: {
      label: "Monto sugerido (RD$, opcional)",
      source: "static",
      kind: "amount",
      schema: z.coerce.number().positive().max(500_000).optional(),
      optional: true
    },
    amount: {
      label: "Monto (RD$)",
      source: "ask",
      kind: "amount",
      schema: z.coerce.number().positive().max(500_000),
      defaultFrom: "suggestedAmount"
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
    const employeeId = payload.employeeId as string | undefined;
    const employee = employeeId
      ? await deps.db.user.findUnique({ where: { id: employeeId }, select: { name: true } })
      : null;
    const employeeName = employee?.name;

    await deps.createTransaction({
      type: "EXPENSE",
      amount,
      occurredAt: new Date(),
      description:
        (payload.note as string | undefined) || (employeeName ? `Pago a ${employeeName}` : "Pago"),
      accountId: payload.accountId as string,
      categoryId: payload.categoryId as string,
      createdById: deps.actorId
    });

    return {
      summary: `Pago de RD$${amount.toLocaleString("es-DO")}${
        employeeName ? ` a ${employeeName}` : ""
      } registrado.`,
      amount
    };
  }
};
