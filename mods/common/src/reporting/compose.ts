/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Small shared helper for assembling a `ReportDocument` from per-page bodies
 * plus the footer every page gets (see `pageFooter` in blocks.ts — page
 * numbers are a hard requirement on every page, not just a multi-page
 * nicety). Each report definition composes its own page bodies (the parts
 * that actually differ) and hands them here instead of re-deriving "Página N
 * de M" assembly six times.
 */
import { page, pageFooter, type ReportElement } from "./blocks.js";
import type { ReportDocument } from "./renderer.js";

/**
 * @param pageBodies - one array of top-level page children per page, NOT
 *   including the footer (this function appends it).
 * @param footerLeft - given the 0-based page index and total page count,
 *   returns the footer's left-column lines for that page (e.g. a longer
 *   verification/reconciliation sentence only on the last page).
 */
export function composeReportPages(
  pageBodies: ReportElement[][],
  footerLeft: (pageIndex: number, totalPages: number) => string[]
): ReportDocument {
  const total = pageBodies.length;
  return {
    pages: pageBodies.map((body, i) => ({
      layout: page([...body, pageFooter({ left: footerLeft(i, total), page: i + 1, pages: total })])
    }))
  };
}
