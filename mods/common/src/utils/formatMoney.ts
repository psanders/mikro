/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Dominican-Republic-style money display: comma thousands, period decimals, always 2 fraction digits (e.g. 13,000.00).
 */

const moneyFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

export type FormatMoneyInput = number | string | { toString(): string };

export function formatMoney(value: FormatMoneyInput): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "0.00";
  return moneyFormatter.format(n);
}
