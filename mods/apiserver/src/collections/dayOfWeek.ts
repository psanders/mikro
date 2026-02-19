/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Map JavaScript Date.getDay() to Prisma DayOfWeek enum.
 */

import { DayOfWeek } from "../generated/prisma/enums.js";

const MS_PER_DAY = 1000 * 60 * 60 * 24;

const JS_DAY_TO_DAY_OF_WEEK: Array<(typeof DayOfWeek)[keyof typeof DayOfWeek]> = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY
];

/**
 * Returns the current day of week as the Prisma DayOfWeek enum.
 */
export function getTodayDayOfWeek(
  date: Date = new Date()
): (typeof DayOfWeek)[keyof typeof DayOfWeek] {
  return JS_DAY_TO_DAY_OF_WEEK[date.getUTCDay()];
}

/** Number of days in a given month (1-indexed month). */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * True if today is a payment day for the loan.
 *
 * All date comparisons use UTC to stay consistent with DB-sourced dates.
 *
 * - DAILY: always true
 * - WEEKLY: true if today matches the preferred payment day
 * - BIWEEKLY: true if the number of days since startingDate is divisible by 14
 * - MONTHLY: true if today's day-of-month matches startingDate's day-of-month
 *   (clamped for short months)
 */
export function isPaymentDayToday(
  paymentFrequency: string,
  preferredPaymentDay: string | null,
  startingDate: Date,
  date: Date = new Date()
): boolean {
  if (paymentFrequency === "DAILY") return true;

  if (paymentFrequency === "WEEKLY") {
    if (!preferredPaymentDay) return false;
    return getTodayDayOfWeek(date) === preferredPaymentDay;
  }

  if (paymentFrequency === "BIWEEKLY") {
    const daysSince = Math.floor((date.getTime() - new Date(startingDate).getTime()) / MS_PER_DAY);
    if (daysSince <= 0) return false;
    return daysSince % 14 === 0;
  }

  if (paymentFrequency === "MONTHLY") {
    const startDay = new Date(startingDate).getUTCDate();
    const todayDay = date.getUTCDate();
    const maxDay = daysInMonth(date.getUTCFullYear(), date.getUTCMonth() + 1);
    const dueDay = Math.min(startDay, maxDay);
    return todayDay === dueDay;
  }

  return false;
}

/** DayOfWeek enum to Spanish label for template {{payment_day}}. */
const DAY_OF_WEEK_SPANISH: Record<string, string> = {
  MONDAY: "lunes",
  TUESDAY: "martes",
  WEDNESDAY: "miércoles",
  THURSDAY: "jueves",
  FRIDAY: "viernes",
  SATURDAY: "sábado",
  SUNDAY: "domingo"
};

/**
 * Format payment day for WhatsApp template {{payment_day}}.
 *
 * - WEEKLY / BIWEEKLY with preferred day: Spanish day name (e.g. "lunes")
 * - MONTHLY: "los {day} de cada mes"
 * - DAILY or no preference: "hoy"
 */
export function formatPaymentDayForTemplate(
  paymentFrequency: string,
  preferredPaymentDay: string | null,
  startingDate: Date
): string {
  if (paymentFrequency === "MONTHLY") {
    const day = new Date(startingDate).getUTCDate();
    return `los ${day} de cada mes`;
  }

  if ((paymentFrequency === "WEEKLY" || paymentFrequency === "BIWEEKLY") && preferredPaymentDay) {
    return DAY_OF_WEEK_SPANISH[preferredPaymentDay] ?? preferredPaymentDay;
  }

  return "hoy";
}
