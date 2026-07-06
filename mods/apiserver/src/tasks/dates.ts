/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Calendar math for founder tasks, all in America/Santo_Domingo (fixed UTC-4,
 * no DST — which is why plain offset arithmetic is safe here).
 */
import { TASK_UTC_OFFSET_HOURS, type TaskFrequency } from "@mikro/common";

const OFFSET_MS = TASK_UTC_OFFSET_HOURS * 60 * 60 * 1000;

/** The Santo Domingo wall-clock parts of a UTC instant. */
export function localParts(instant: Date): {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  weekday: number; // 0=Sunday..6=Saturday
} {
  const shifted = new Date(instant.getTime() + OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay()
  };
}

/** UTC instant for a Santo Domingo wall-clock date + HH:MM. */
export function instantFor(year: number, month: number, day: number, timeOfDay: string): Date {
  const [hours, minutes] = timeOfDay.split(":").map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours, minutes) - OFFSET_MS);
}

/** YYYY-MM-DD of a UTC instant in Santo Domingo wall-clock. */
export function localDateString(instant: Date): string {
  const { year, month, day } = localParts(instant);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** UTC range [start, end) covering one Santo Domingo calendar date (YYYY-MM-DD). */
export function localDayRange(dateString: string): { start: Date; end: Date } {
  const [year, month, day] = dateString.split("-").map(Number);
  const start = instantFor(year, month, day, "00:00");
  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export interface ScheduleFields {
  frequency: TaskFrequency;
  weekday: number | null;
  dayOfMonth: number | null;
  onDate: string | null;
  timeOfDay: string;
}

/**
 * The next fire instant strictly after `after`. Returns null when a `once`
 * task's moment has already passed (nothing left to fire).
 */
export function computeNextFireAt(schedule: ScheduleFields, after: Date): Date | null {
  const { frequency, timeOfDay } = schedule;

  if (frequency === "once") {
    const [year, month, day] = (schedule.onDate as string).split("-").map(Number);
    const at = instantFor(year, month, day, timeOfDay);
    return at > after ? at : null;
  }

  if (frequency === "daily") {
    const { year, month, day } = localParts(after);
    const today = instantFor(year, month, day, timeOfDay);
    if (today > after) return today;
    return new Date(today.getTime() + 24 * 60 * 60 * 1000);
  }

  if (frequency === "weekly") {
    const target = schedule.weekday as number;
    const { year, month, day, weekday } = localParts(after);
    const sameDay = instantFor(year, month, day, timeOfDay);
    let daysAhead = (target - weekday + 7) % 7;
    if (daysAhead === 0 && sameDay <= after) daysAhead = 7;
    return new Date(sameDay.getTime() + daysAhead * 24 * 60 * 60 * 1000);
  }

  // monthly, with day-of-month clamped to the month's last day
  const target = schedule.dayOfMonth as number;
  const { year, month } = localParts(after);
  for (let i = 0; i < 2; i++) {
    const m = month + i;
    const y = year + Math.floor((m - 1) / 12);
    const mm = ((m - 1) % 12) + 1;
    const day = Math.min(target, daysInMonth(y, mm));
    const at = instantFor(y, mm, day, timeOfDay);
    if (at > after) return at;
  }
  // Unreachable: one of the two candidate months is always in the future.
  return null;
}
