/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Deterministic page-safe-space model. Every constant here is arithmetic
 * derived from a real block's paddings/font-sizes/line-heights/borders/gaps
 * (see `blocks.ts` for the block implementations these mirror) — not a
 * hand-tuned "N rows fits" number picked by trial and error.
 *
 * Why this exists: satori pages are FIXED size. If a page's stacked content
 * exceeds `PAGE_HEIGHT`, Yoga's flex-shrink produces degenerate (zero or
 * negative) geometry, which crashes the native resvg rasterizer with an
 * unrecoverable process abort — not a catchable JS error (issue #202). Every
 * report MUST keep its per-page content at or under the page height, and the
 * only reliable way to guarantee that across arbitrarily large inputs
 * (hundreds of cuotas, dozens of at-risk notes, an LLM narrative of unknown
 * length) is to compute a row/entry budget from the page's real geometry
 * before laying anything out, then chunk the data to fit — see
 * `paginateRows` (blocks.ts) and `paginateByEstimatedHeight` (below).
 *
 * `SAFETY_FACTOR` absorbs the slop between this model (line-height ≈
 * fontSize × 1.25, a documented approximation of Inter's real metrics) and
 * satori's actual measurement — it is not a substitute for correct arithmetic
 * above it. If a future block tweak (bigger padding, taller font) invalidates
 * these constants, the unit tests in
 * `mods/common/test/reporting/layout.test.ts` assert the derived budgets stay
 * under the last known-crash boundary, so a regression fails loudly instead
 * of silently shipping a page that can abort the whole process.
 */
import { PAGE_HEIGHT, PAGE_PADDING, PAGE_GAP } from "./blocks.js";

/** Approximation of Inter's line-height at these weights/sizes, rounded up. */
const LH = 1.25;

function lineHeightPx(fontSizePx: number): number {
  return Math.ceil(fontSizePx * LH);
}

/**
 * Margin applied to every derived row/entry budget so a future block tweak
 * (padding, font-size) doesn't immediately tip a page over the crash
 * boundary — mirrors the ~35% margin the old hand-tuned `TABLE_ROWS_*`
 * constants used, expressed as a documented multiplier instead of a magic
 * number baked into each report.
 */
export const SAFETY_FACTOR = 0.9;

// ==================== brandHeader ====================

const LOGO_TILE_PX = 31;
const HEADER_COLUMN_GAP_PX = 16; // gap between the logo row and the title block
const TITLE_FONT_PX = 27;
const TITLE_SUBTITLE_GAP_PX = 4;
const SUBTITLE_FONT_PX = 13;
const EYEBROW_FONT_PX = 10;
const EYEBROW_META_GAP_PX = 9;
const META_ROW_FONT_PX = 12;
const META_ROW_GAP_PX = 4;

const HEADER_LEFT_COLUMN_HEIGHT =
  LOGO_TILE_PX +
  HEADER_COLUMN_GAP_PX +
  lineHeightPx(TITLE_FONT_PX) +
  TITLE_SUBTITLE_GAP_PX +
  lineHeightPx(SUBTITLE_FONT_PX);

/** Right column height for a header with `metaRows` key/value meta lines. */
export function headerRightColumnHeight(metaRows: number): number {
  const metaHeight =
    metaRows > 0 ? metaRows * lineHeightPx(META_ROW_FONT_PX) + (metaRows - 1) * META_ROW_GAP_PX : 0;
  return lineHeightPx(EYEBROW_FONT_PX) + EYEBROW_META_GAP_PX + metaHeight;
}

/** `brandHeader` height — the two columns stack independently; the row's height is the taller one. */
export function headerHeight(metaRows = 3): number {
  return Math.max(HEADER_LEFT_COLUMN_HEIGHT, headerRightColumnHeight(metaRows));
}

/** The common case (3 meta rows: Generado / a context row / a context row). */
export const HEADER_HEIGHT = headerHeight(3);

// ==================== kpiGrid ====================

const KPI_CELL_PAD_V = 30; // "15px 16px" top+bottom
const KPI_LABEL_FONT_PX = 10;
const KPI_VALUE_FONT_PX = 19; // sized down from Pencil's 22 so decimal-laden figures fit their cells
const KPI_SUBTEXT_FONT_PX = 11;
const KPI_ROW_GAP_PX = 5; // matches kpiGrid's internal cell `gap`
const KPI_BORDER_PX = 1;

/**
 * `kpiGrid` height for `rows` stacked rows. `hasSubtext` is a page-wide
 * worst-case flag (not per-cell) — a grid mixing subtext and non-subtext
 * cells still reserves the taller row height for all of them, since row
 * height is uniform across a `kpiGrid` row.
 */
export function kpiGridHeight(rows: number, hasSubtext = true): number {
  const contentHeight =
    lineHeightPx(KPI_LABEL_FONT_PX) +
    KPI_ROW_GAP_PX +
    lineHeightPx(KPI_VALUE_FONT_PX) +
    (hasSubtext ? KPI_ROW_GAP_PX + lineHeightPx(KPI_SUBTEXT_FONT_PX) : 0);
  const rowHeight = KPI_CELL_PAD_V + contentHeight;
  // Outer card border (top+bottom) + one border between each pair of rows.
  return rows * rowHeight + (rows + 1) * KPI_BORDER_PX;
}

// ==================== verificationBanner / noteCard ====================

const BANNER_PAD_V = 28; // "14px 16px" top+bottom
const BANNER_HEADLINE_FONT_PX = 12;
const BANNER_HEADLINE_GAP_PX = 4;
const BANNER_EXPLANATION_FONT_PX = 11;
const BANNER_EXPLANATION_LH = 1.4;

/** `verificationBanner`/`noteCard` height for `explanationLines` of body text. */
export function verificationBannerHeight(explanationLines = 2): number {
  return (
    BANNER_PAD_V +
    lineHeightPx(BANNER_HEADLINE_FONT_PX) +
    BANNER_HEADLINE_GAP_PX +
    explanationLines * Math.ceil(BANNER_EXPLANATION_FONT_PX * BANNER_EXPLANATION_LH)
  );
}

// ==================== section title ====================

const SECTION_TITLE_FONT_PX = 16;
const SECTION_TITLE_BODY_GAP_PX = 10; // section()'s internal gap between the title row and its children

export const SECTION_TITLE_HEIGHT = lineHeightPx(SECTION_TITLE_FONT_PX) + SECTION_TITLE_BODY_GAP_PX;

// ==================== dataTable ====================

const TABLE_HEADER_PAD_V = 20; // "10px 15px" top+bottom
const TABLE_HEADER_FONT_PX = 10;
const TABLE_BORDER_PX = 1;
/** The outer card wrapper's top+bottom border (the header's own bottom border is counted separately). */
export const TABLE_CARD_BORDER_PX = 2 * TABLE_BORDER_PX;

export const TABLE_HEADER_HEIGHT =
  TABLE_HEADER_PAD_V + lineHeightPx(TABLE_HEADER_FONT_PX) + TABLE_BORDER_PX;

const TABLE_ROW_PAD_V = 20; // "10px 15px" top+bottom
const TABLE_ROW_LINE_PX = 15; // one 12px line's rendered line-box, calibrated empirically against the receipts pipeline (not the generic `LH` estimate)

/**
 * Single-line body row height: padding + one text line + bottom border. This
 * is the number the whole row-budget model is built to protect: every
 * `dataTable` body row is exactly this tall (see blocks.ts — no more
 * `wrapLines`/fixed-row-height variability now that the Notas column left the
 * table for its own paginated section).
 */
export const TABLE_ROW_HEIGHT = TABLE_ROW_PAD_V + TABLE_ROW_LINE_PX + TABLE_BORDER_PX;

// ==================== footer ====================

const FOOTER_PAD_TOP_PX = 10;
const FOOTER_BORDER_PX = 1;
const FOOTER_LINE_PX = 13; // 10px/500 line-box
const FOOTER_LINE_GAP_PX = 2;

/** `pageFooter` height for `leftLines` stacked left-column lines (right column is always 1 line). */
export function footerHeight(leftLines = 1): number {
  const lines = Math.max(1, leftLines);
  return (
    FOOTER_PAD_TOP_PX + FOOTER_BORDER_PX + lines * FOOTER_LINE_PX + (lines - 1) * FOOTER_LINE_GAP_PX
  );
}

export const FOOTER_HEIGHT = footerHeight(1);

// ==================== row/entry budgets ====================

const CONTENT_HEIGHT = PAGE_HEIGHT - 2 * PAGE_PADDING;

export interface TableRowBudgetParams {
  /**
   * Heights of the page-level siblings stacked above the table (e.g.
   * `[HEADER_HEIGHT, verificationBannerHeight(), kpiGridHeight(2)]` on a
   * first page; omit entirely on a continuation page with no header/KPI).
   */
  aboveHeights?: number[];
  /** Footer left-column line count on this page (see `footerHeight`). */
  footerLeftLines?: number;
  safetyFactor?: number;
  /**
   * Whether this page repeats the section title above the table. A
   * continuation page renders the bare `dataTable` (its own header row is
   * always present) with NO repeated `section(title, …)` wrapper — the
   * title appears once, on the table's first page, since the footer's
   * "Página N de M" already conveys pagination and a repeated
   * "Título (2/5)" both duplicates that and burns a line of vertical space
   * on every continuation page. Default `true` (first-page shape); pass
   * `false` for continuation-page budgets to reclaim that height as rows.
   */
  includeSectionTitle?: boolean;
}

/**
 * Max `dataTable` body rows that fit a page shaped like
 * `[...aboveHeights, table (± its section title), footer]`, with the
 * documented {@link SAFETY_FACTOR} margin applied. Callers pass this
 * straight to `paginateRows`'s `firstPageMax`/`otherPagesMax`.
 */
export function tableRowBudget(params: TableRowBudgetParams = {}): number {
  const {
    aboveHeights = [],
    footerLeftLines = 1,
    safetyFactor = SAFETY_FACTOR,
    includeSectionTitle = true
  } = params;
  const aboveSum = aboveHeights.reduce((sum, h) => sum + h, 0);
  // Page-level `gap` (PAGE_GAP) separates every top-level child: each entry
  // in `aboveHeights`, the table (bare or section-wrapped — either way
  // exactly one top-level child), and the footer — i.e.
  // (aboveHeights.length + 2) children, (aboveHeights.length + 1) gaps.
  const gaps = (aboveHeights.length + 1) * PAGE_GAP;
  const tableChrome =
    (includeSectionTitle ? SECTION_TITLE_HEIGHT : 0) + TABLE_HEADER_HEIGHT + TABLE_CARD_BORDER_PX;
  const available = CONTENT_HEIGHT - aboveSum - gaps - footerHeight(footerLeftLines) - tableChrome;
  const rows = Math.floor(available / TABLE_ROW_HEIGHT);
  return Math.max(0, Math.floor(rows * safetyFactor));
}

// ==================== variable-height content (notes, narrative) ====================

/** Page content width available to free-flowing text (`PAGE_WIDTH` minus both side paddings). */
export const CONTENT_WIDTH = 816 - 2 * PAGE_PADDING;

/**
 * Conservative characters-per-line for 12px Inter body text at `widthPx` —
 * deliberately pessimistic (real Inter averages narrower) so the line-count
 * estimate below over-, not under-, counts wrapped lines. Variable-height
 * content (LLM-generated notes/narrative) has no fixed-row-height escape
 * hatch like `dataTable` does, so overestimating height is the safe
 * direction — it costs a little blank space, never a crash.
 */
const CHARS_PER_LINE_DIVISOR = 5.5;

export function estimateWrappedLines(text: string, widthPx: number): number {
  const perLine = Math.max(1, Math.floor(widthPx / CHARS_PER_LINE_DIVISOR));
  return Math.max(1, Math.ceil(text.length / perLine));
}

const NOTES_ENTRY_NAME_FONT_PX = 12;
const NOTES_ENTRY_BODY_FONT_PX = 11;
const NOTES_ENTRY_NAME_GAP_PX = 4;
/** Gap + divider border between two "Notas de cobro" entries. */
export const NOTES_ENTRY_SEPARATOR_PX = 14 + 1;

/** Estimated height of one "Notas de cobro" entry (name line + wrapped note body). */
export function estimateNoteEntryHeight(noteText: string, widthPx = CONTENT_WIDTH): number {
  const lines = estimateWrappedLines(noteText, widthPx);
  return (
    lineHeightPx(NOTES_ENTRY_NAME_FONT_PX) +
    NOTES_ENTRY_NAME_GAP_PX +
    lines * lineHeightPx(NOTES_ENTRY_BODY_FONT_PX)
  );
}

/**
 * Bin-packs `items` into page-sized chunks by estimated height instead of a
 * fixed row count — for content whose height genuinely varies per item
 * (at-risk notes, an LLM narrative section) where a `dataTable`-style fixed
 * row height doesn't apply. Greedy first-fit: keeps adding items to the
 * current page while they fit `budget`; always keeps at least one item per
 * page (an oversized single item still gets its own page rather than being
 * dropped) so pathological input degrades to "more pages," never data loss.
 */
export function paginateByEstimatedHeight<T>(
  items: T[],
  estimateHeight: (item: T) => number,
  firstPageBudget: number,
  continuationBudget: number = firstPageBudget,
  separator = 0
): T[][] {
  if (items.length === 0) return [[]];
  const pages: T[][] = [];
  let current: T[] = [];
  let used = 0;
  let budget = firstPageBudget;

  for (const item of items) {
    const height = estimateHeight(item);
    const withSeparator = current.length > 0 ? height + separator : height;
    if (current.length > 0 && used + withSeparator > budget) {
      pages.push(current);
      current = [item];
      used = height;
      budget = continuationBudget;
    } else {
      current.push(item);
      used += withSeparator;
    }
  }
  if (current.length > 0) pages.push(current);
  return pages;
}
