/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Shared type and choices for member preferred payment day (used by members:create and members:update).
 */

export type PreferredPaymentDay =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export const PREFERRED_PAYMENT_DAY_CHOICES: Array<{ name: string; value: PreferredPaymentDay }> = [
  { name: "Monday", value: "MONDAY" },
  { name: "Tuesday", value: "TUESDAY" },
  { name: "Wednesday", value: "WEDNESDAY" },
  { name: "Thursday", value: "THURSDAY" },
  { name: "Friday", value: "FRIDAY" },
  { name: "Saturday", value: "SATURDAY" },
  { name: "Sunday", value: "SUNDAY" }
];

export const PREFERRED_PAYMENT_DAY_OPTIONS: PreferredPaymentDay[] =
  PREFERRED_PAYMENT_DAY_CHOICES.map((c) => c.value);
