/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * The one source of installment due dates. The contract PDF, cycle metrics,
 * mora, the repayment schedule and `due:` tags all derive cuota i from here.
 *
 * Every date in and out is a UTC calendar day (00:00:00.000Z); inputs carrying
 * a time are truncated to their UTC day first.
 *
 * - DAILY:    every day from the first cuota
 * - WEEKLY:   every 7 days from the first cuota
 * - BIWEEKLY: quincenal — the 15th and the last day of each month
 * - MONTHLY:  the first cuota's day of month, clamped in short months
 */
import type { PaymentFrequency } from "./calculateLoan.js";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function utcDay(date: Date): Date {
  const d = new Date(date);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** `day` of month `month` (0-based, may run past 11) of `year`, clamped to the month's length. */
function clampedDay(year: number, month: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDay)));
}

/** BIWEEKLY: the next 15th or last day of month on or after `date`. Other frequencies: `date` unchanged. */
export function snapFirstDueDate(date: Date, freq: PaymentFrequency): Date {
  const d = utcDay(date);
  if (freq !== "BIWEEKLY") return d;
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  return d.getUTCDate() <= 15 ? new Date(Date.UTC(year, month, 15)) : clampedDay(year, month, 31);
}

/**
 * Due date of cuota `index` (0 = first cuota).
 *
 * - DAILY:    first + index days
 * - WEEKLY:   first + 7·index days
 * - BIWEEKLY: quincenal sequence starting at snapFirstDueDate(first) (15 → last-of-month → 15 …)
 * - MONTHLY:  first's month + index, day = min(monthDay ?? first's day, days in that month)
 */
export function getInstallmentDueDate(
  firstDueDate: Date,
  index: number,
  freq: PaymentFrequency,
  monthDay?: number
): Date {
  const first = utcDay(firstDueDate);
  switch (freq) {
    case "DAILY":
      return addDays(first, index);
    case "BIWEEKLY": {
      const start = snapFirstDueDate(first, freq);
      // Half-month slots: even = the 15th, odd = month-end.
      const slot = (start.getUTCDate() === 15 ? 0 : 1) + index;
      const month = start.getUTCMonth() + Math.floor(slot / 2);
      return slot % 2 === 0
        ? new Date(Date.UTC(start.getUTCFullYear(), month, 15))
        : clampedDay(start.getUTCFullYear(), month, 31);
    }
    case "MONTHLY":
      return clampedDay(
        first.getUTCFullYear(),
        first.getUTCMonth() + index,
        monthDay ?? first.getUTCDate()
      );
    case "WEEKLY":
    default:
      return addDays(first, index * 7);
  }
}

/** The fields of a loan its due dates depend on. */
export interface LoanDueDateFields {
  firstDueDate?: Date | null;
  startingDate?: Date | null;
  createdAt: Date;
  paymentFrequency: PaymentFrequency;
}

/**
 * First cuota of a loan: `firstDueDate` when set; otherwise the legacy anchor
 * (startingDate ?? createdAt) + 1 period (+1 d / +7 d / +14 d then snapped /
 * +1 month clamped). The customer's preferred payment day plays no part.
 */
export function resolveFirstDueDate(loan: LoanDueDateFields): Date {
  if (loan.firstDueDate) return utcDay(loan.firstDueDate);
  const anchor = utcDay(loan.startingDate ?? loan.createdAt);
  switch (loan.paymentFrequency) {
    case "DAILY":
      return addDays(anchor, 1);
    case "BIWEEKLY":
      return snapFirstDueDate(addDays(anchor, 14), "BIWEEKLY");
    case "MONTHLY":
      return clampedDay(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, anchor.getUTCDate());
    case "WEEKLY":
    default:
      return addDays(anchor, 7);
  }
}

/**
 * Due date of cuota `index` of a loan. The one function every engine, schedule,
 * statement and tag consumer calls. A MONTHLY loan without `firstDueDate` keeps
 * the legacy anchor's day of month (anchor 31 ene → 28 feb, 31 mar).
 */
export function getLoanDueDate(loan: LoanDueDateFields, index: number): Date {
  const monthDay =
    loan.paymentFrequency === "MONTHLY" && !loan.firstDueDate
      ? utcDay(loan.startingDate ?? loan.createdAt).getUTCDate()
      : undefined;
  return getInstallmentDueDate(resolveFirstDueDate(loan), index, loan.paymentFrequency, monthDay);
}
