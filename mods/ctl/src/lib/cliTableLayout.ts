/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Helpers for cliui tables: derive column widths from header + cell strings,
 * optional min/max per column, and cap total width to the TTY when available.
 */

import cliui from "cliui";

const ZERO_PADDING = [0, 0, 0, 0] as const;

/** Spaces after each cell except the last column (cliui padding index = right). */
export const DEFAULT_COLUMN_GUTTER = 2;

type CliuiInstance = ReturnType<typeof cliui>;
export type CliuiSpan = Parameters<CliuiInstance["div"]>[number];

/** Display width for layout; swap for grapheme-aware width if needed later. */
export function cellWidth(text: string): number {
  return text.length;
}

export type ComputeColumnWidthsInput = {
  headers: string[];
  rows: string[][];
  /** Per-column minimum; omit an index to leave unconstrained below natural width. */
  minWidths?: Array<number | undefined>;
  /** Per-column maximum; omit an index to leave unconstrained above natural width. */
  maxWidths?: Array<number | undefined>;
  /** When omitted, uses TTY width when available, otherwise no cap. */
  maxTotalWidth?: number;
};

function defaultMaxTotalWidth(): number | undefined {
  if (
    process.stdout.isTTY &&
    typeof process.stdout.columns === "number" &&
    process.stdout.columns > 0
  ) {
    return process.stdout.columns;
  }
  return undefined;
}

/**
 * Natural widths from content, clamped by min/max, then shrunk if sum exceeds maxTotalWidth.
 */
export function computeColumnWidths(input: ComputeColumnWidthsInput): number[] {
  const { headers, rows, minWidths, maxWidths } = input;
  const maxTotal = input.maxTotalWidth ?? defaultMaxTotalWidth();
  const colCount = headers.length;
  if (colCount === 0) return [];

  /** Inner width: room for text only (no inter-column gutter). */
  const inner: number[] = [];
  for (let j = 0; j < colCount; j++) {
    let w = cellWidth(headers[j] ?? "");
    for (const row of rows) {
      const cell = row[j] ?? "";
      w = Math.max(w, cellWidth(cell));
    }
    if (minWidths?.[j] !== undefined) w = Math.max(w, minWidths[j]!);
    if (maxWidths?.[j] !== undefined) w = Math.min(w, maxWidths[j]!);
    inner.push(Math.max(1, w));
  }

  // Outer column width = inner + right gutter (cliui), except last column.
  const widths = inner.map((w, j) => w + (j < colCount - 1 ? DEFAULT_COLUMN_GUTTER : 0));

  if (maxTotal === undefined) return widths;

  let sum = widths.reduce((a, b) => a + b, 0);
  const minOuter = (j: number) => inner[j]! + (j < colCount - 1 ? DEFAULT_COLUMN_GUTTER : 0);

  while (sum > maxTotal) {
    let best = -1;
    let bestW = -1;
    for (let j = 0; j < colCount; j++) {
      if (widths[j]! > minOuter(j) && widths[j]! > bestW) {
        bestW = widths[j]!;
        best = j;
      }
    }
    if (best < 0) break;
    widths[best]!--;
    sum--;
  }

  return widths;
}

export function cliuiTableWidth(widths: number[]): number {
  return widths.reduce((a, b) => a + b, 0);
}

export function cliuiCells(texts: string[], widths: number[]): CliuiSpan[] {
  const last = texts.length - 1;
  return texts.map((text, i) => ({
    text,
    padding:
      i < last
        ? [0, DEFAULT_COLUMN_GUTTER, 0, 0]
        : ([...ZERO_PADDING] as [number, number, number, number]),
    width: widths[i]!
  }));
}
