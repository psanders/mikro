/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Map JavaScript Date.getDay() to Prisma DayOfWeek enum.
 */

import { DayOfWeek } from "../generated/prisma/enums.js";

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
  return JS_DAY_TO_DAY_OF_WEEK[date.getDay()];
}

/**
 * True if today is the member's preferred payment day (WEEKLY), or always true for DAILY loans.
 */
export function isPaymentDayToday(
  paymentFrequency: string,
  preferredPaymentDay: string | null,
  date: Date = new Date()
): boolean {
  if (paymentFrequency === "DAILY") return true;
  if (paymentFrequency !== "WEEKLY" || !preferredPaymentDay) return false;
  return getTodayDayOfWeek(date) === preferredPaymentDay;
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
 * WEEKLY: day name in Spanish (e.g. "lunes"). DAILY or no preference: "hoy".
 */
export function formatPaymentDayForTemplate(
  paymentFrequency: string,
  preferredPaymentDay: string | null
): string {
  if (paymentFrequency === "DAILY" || !preferredPaymentDay) return "hoy";
  return DAY_OF_WEEK_SPANISH[preferredPaymentDay] ?? preferredPaymentDay;
}
