/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Reusable satori layout blocks for the branded report PDF, matching the issue
 * #161 look/feel. Each block returns a plain element tree (same shape the
 * receipts layouts use) that the renderer feeds to satori → SVG → PNG. Blocks
 * are pure and composable; the report definitions assemble them into pages.
 *
 * Uses the Mikro brand tokens and the Inter font loaded via the receipts
 * `loadFonts` path (the renderer supplies the fonts; blocks only reference
 * `fontFamily: "Inter"`).
 */

/** A satori element node (mirrors the receipts `ReceiptElement`). */
export interface ReportElement {
  type: string;
  props: {
    [key: string]: unknown;
    style?: Record<string, unknown>;
    children?: unknown;
  };
}

/** Mikro brand tokens (issue #161 palette). */
export const BRAND = {
  blueDeep: "#103A8A",
  ink: "#14254A",
  orangePrimary: "#F68A1F",
  orangeDeep: "#E85B1C",
  yellowAccent: "#FFD447",
  mist: "#E9F2FF",
  muted: "#5B6472",
  border: "#D8E0EC",
  white: "#FFFFFF"
} as const;

/** US Letter portrait at 96dpi. Rendered at 2x by the renderer. */
export const PAGE_WIDTH = 816;
export const PAGE_HEIGHT = 1056;
const PAGE_PADDING = 48;

function txt(content: string, style: Record<string, unknown> = {}): ReportElement {
  return {
    type: "div",
    props: {
      style: { fontFamily: "Inter", display: "flex", ...style },
      children: content
    }
  };
}

/** Brand header: tile logo + title/subtitle on the left, right-aligned meta lines. */
export function brandHeader(params: {
  title: string;
  subtitle?: string;
  meta?: string[];
}): ReportElement {
  const { title, subtitle, meta = [] } = params;
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        width: "100%",
        paddingBottom: "20px",
        borderBottom: `3px solid ${BRAND.blueDeep}`
      },
      children: [
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "row", alignItems: "center", gap: "14px" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "56px",
                    height: "56px",
                    borderRadius: "12px",
                    backgroundColor: BRAND.blueDeep
                  },
                  children: [
                    txt("m", {
                      fontSize: "34px",
                      fontWeight: 900,
                      color: BRAND.white,
                      lineHeight: 1,
                      // satori positions text on its baseline within the line
                      // box, so an ascender/descender-free glyph like "m" sits
                      // visually low; nudge it up to optically center it in the
                      // tile (measured: -6px zeroes the top/bottom gap here).
                      marginTop: "-6px"
                    })
                  ]
                }
              },
              {
                type: "div",
                props: {
                  style: { display: "flex", flexDirection: "column", gap: "2px" },
                  children: [
                    txt(title, { fontSize: "24px", fontWeight: 900, color: BRAND.ink }),
                    subtitle
                      ? txt(subtitle, { fontSize: "13px", fontWeight: 400, color: BRAND.muted })
                      : txt("", { height: "0px" })
                  ]
                }
              }
            ]
          }
        },
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              gap: "3px"
            },
            children:
              meta.length > 0
                ? meta.map((m, i) =>
                    txt(m, {
                      fontSize: "12px",
                      fontWeight: i === 0 ? 700 : 400,
                      color: i === 0 ? BRAND.ink : BRAND.muted
                    })
                  )
                : [txt("", { height: "0px" })]
          }
        }
      ]
    }
  };
}

/** Verification / notice banner: bold headline + explanation. tone tints it. */
export function verificationBanner(params: {
  headline: string;
  explanation: string;
  tone?: "pass" | "fail" | "info";
}): ReportElement {
  const { headline, explanation, tone = "info" } = params;
  const bg = tone === "fail" ? "#FDECEA" : tone === "pass" ? BRAND.mist : BRAND.mist;
  const accent =
    tone === "fail" ? BRAND.orangeDeep : tone === "pass" ? BRAND.blueDeep : BRAND.blueDeep;
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        width: "100%",
        padding: "14px 18px",
        borderRadius: "10px",
        backgroundColor: bg,
        borderLeft: `5px solid ${accent}`
      },
      children: [
        txt(headline, { fontSize: "15px", fontWeight: 700, color: accent }),
        txt(explanation, { fontSize: "12px", fontWeight: 400, color: BRAND.ink })
      ]
    }
  };
}

/** One KPI cell descriptor. */
export interface KpiCell {
  label: string;
  value: string;
  subtext?: string;
  /** When true the value is rendered in orange for emphasis. */
  emphasize?: boolean;
}

/** Bordered KPI grid — cells with label, value, optional subtext. */
export function kpiGrid(params: { cells: KpiCell[]; columns?: number }): ReportElement {
  const { cells, columns = 4 } = params;
  const widthPct = `${100 / columns}%`;
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        width: "100%",
        border: `1px solid ${BRAND.border}`,
        borderRadius: "10px"
      },
      children: cells.map((c) => ({
        type: "div",
        props: {
          style: {
            display: "flex",
            flexDirection: "column",
            gap: "5px",
            width: widthPct,
            padding: "14px 16px",
            borderRight: `1px solid ${BRAND.border}`,
            borderBottom: `1px solid ${BRAND.border}`
          },
          children: [
            txt(c.label.toUpperCase(), {
              fontSize: "10px",
              fontWeight: 700,
              color: BRAND.muted,
              letterSpacing: "0.5px"
            }),
            txt(c.value, {
              fontSize: "20px",
              fontWeight: 900,
              color: c.emphasize ? BRAND.orangeDeep : BRAND.ink
            }),
            c.subtext
              ? txt(c.subtext, { fontSize: "10px", fontWeight: 400, color: BRAND.muted })
              : txt("", { height: "0px" })
          ]
        }
      }))
    }
  };
}

/** A table column definition. */
export interface TableColumn {
  key: string;
  header: string;
  /** flex weight for column width. */
  weight?: number;
  align?: "left" | "right" | "center";
  /**
   * Max lines this column's body cells may wrap onto before clipping with an
   * ellipsis (default 1 — the single-line clamp everywhere else). Only raise
   * this for a column that genuinely needs it (e.g. free-text notes) — every
   * column sharing a row still shares that row's height, and `dataTable`
   * gives the whole row an explicit fixed height once any column asks for
   * more than 1 line (see the comment above `ROW_LINE_HEIGHT_PX`).
   */
  wrapLines?: number;
}

/** A table row: cell text keyed by column, plus an optional status pill value. */
export interface TableRow {
  cells: Record<string, string>;
  /** When set, this column key renders as a text status pill. */
  status?: {
    column: string;
    value: string;
    tone?: "paid" | "partial" | "overdue" | "upcoming" | "dueToday" | "info";
  };
}

const PILL_TONES: Record<string, { bg: string; fg: string }> = {
  paid: { bg: "#E4F4EA", fg: "#1B7A43" },
  // Amber (loan-statement "Parcial" pill) — distinct from the blue "info" mist tone.
  partial: { bg: "#FEF3E2", fg: BRAND.orangePrimary },
  overdue: { bg: "#FDECEA", fg: BRAND.orangeDeep },
  upcoming: { bg: "#F0F2F6", fg: BRAND.muted },
  // Yellow (loan-statement "Vence hoy" — due today, distinct from red "Sin pago").
  dueToday: { bg: "#FFF6D9", fg: "#8A6A00" },
  // Blue mist (e.g. renewal "Activo", accounting "Depósito") — added for the
  // 5-report migration; additive only, no existing caller used this tone.
  info: { bg: BRAND.mist, fg: BRAND.blueDeep }
};

function pill(value: string, tone: string): ReportElement {
  const c = PILL_TONES[tone] ?? PILL_TONES.upcoming;
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        alignSelf: "flex-start",
        padding: "3px 10px",
        borderRadius: "999px",
        backgroundColor: c.bg
      },
      children: [txt(value, { fontSize: "11px", fontWeight: 700, color: c.fg })]
    }
  };
}

/**
 * Forces a cell's text onto a single line (no wrap), clipping overflow with an
 * ellipsis instead of letting the line grow the row's height. Free-text cells
 * (e.g. an LLM-generated notes summary) are otherwise unbounded in length —
 * without this, a long value wraps into many lines and the row's height grows
 * with it. Enough overflowing rows on a fixed-height page eventually forces
 * Yoga to shrink the layout into degenerate (zero/negative) geometry, which
 * crashes the native resvg rasterizer with an unrecoverable process abort
 * (issue #202). Clamping every cell to one line makes row height fixed and
 * predictable, which is what makes the table-pagination math in
 * `paginateRows` safe to rely on.
 */
const SINGLE_LINE_CLAMP: Record<string, unknown> = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  minWidth: "0px"
};

/**
 * A body-cell text box bounded to `lines` lines, clipping any remainder with
 * an ellipsis via satori's `-webkit-line-clamp` support — same idea as
 * {@link SINGLE_LINE_CLAMP} but for a column (e.g. free-text notes) that
 * needs more than one line to avoid clipping most real values. Intrinsic
 * height still varies with actual line count (1..`lines`); it's `dataTable`
 * giving the *row* an explicit fixed height (see `ROW_LINE_HEIGHT_PX` below)
 * that keeps geometry deterministic across rows, not this clamp alone.
 */
function multiLineClamp(lines: number): Record<string, unknown> {
  return {
    display: "-webkit-box",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: lines,
    overflow: "hidden",
    textOverflow: "ellipsis",
    minWidth: "0px"
  };
}

// Matches the 12px body-cell font at the layout's implicit ~1.25 line-height
// (measured against the existing single-line row calibration below).
const ROW_LINE_HEIGHT_PX = 15;
const ROW_VERTICAL_PADDING_PX = 18; // "9px 12px" top+bottom, see bodyRows padding.

/** Data table with a header row and text status pills (no icons). */
export function dataTable(params: { columns: TableColumn[]; rows: TableRow[] }): ReportElement {
  const { columns, rows } = params;
  const flexFor = (col: TableColumn) => ({ flexGrow: col.weight ?? 1, flexBasis: "0px" });
  const justify = (align?: string) =>
    align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start";
  const clampFor = (col: TableColumn) =>
    col.wrapLines && col.wrapLines > 1 ? multiLineClamp(col.wrapLines) : SINGLE_LINE_CLAMP;

  // When any column wraps onto more than one line, every row (regardless of
  // that row's actual text) gets the same explicit fixed height — sized for
  // the tallest allowed column — instead of an intrinsic, content-driven
  // height. This is what keeps `paginateRows`' row-count budget reliable:
  // Yoga never needs to flex-shrink a row into degenerate geometry (the
  // resvg crash root cause, issue #202) because every row's height is fixed
  // up front rather than derived from its own content.
  const maxWrapLines = Math.max(1, ...columns.map((c) => c.wrapLines ?? 1));
  const fixedRowHeightPx =
    maxWrapLines > 1 ? ROW_VERTICAL_PADDING_PX + maxWrapLines * ROW_LINE_HEIGHT_PX : undefined;

  const headerRow: ReportElement = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "row",
        width: "100%",
        gap: "16px",
        padding: "10px 12px",
        backgroundColor: BRAND.blueDeep,
        borderRadius: "8px 8px 0 0"
      },
      children: columns.map((col) => ({
        type: "div",
        props: {
          style: {
            display: "flex",
            justifyContent: justify(col.align),
            ...flexFor(col),
            ...SINGLE_LINE_CLAMP
          },
          children: [
            txt(col.header.toUpperCase(), {
              fontSize: "10px",
              fontWeight: 700,
              color: BRAND.white,
              letterSpacing: "0.5px"
            })
          ]
        }
      }))
    }
  };

  const bodyRows: ReportElement[] = rows.map((r, i) => ({
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "row",
        width: "100%",
        gap: "16px",
        padding: "9px 12px",
        backgroundColor: i % 2 === 0 ? BRAND.white : "#F7F9FC",
        borderBottom: `1px solid ${BRAND.border}`,
        ...(fixedRowHeightPx
          ? {
              height: `${fixedRowHeightPx}px`,
              minHeight: `${fixedRowHeightPx}px`,
              overflow: "hidden",
              alignItems: "center"
            }
          : {})
      },
      children: columns.map((col) => {
        const isStatus = r.status && r.status.column === col.key;
        return {
          type: "div",
          props: {
            style: {
              display: "flex",
              justifyContent: justify(col.align),
              ...flexFor(col),
              minWidth: "0px"
            },
            children: [
              isStatus
                ? pill(r.status!.value, r.status!.tone ?? "upcoming")
                : txt(r.cells[col.key] ?? "", {
                    fontSize: "12px",
                    fontWeight: 400,
                    color: BRAND.ink,
                    width: "100%",
                    ...clampFor(col)
                  })
            ]
          }
        };
      })
    }
  }));

  return {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", width: "100%" },
      children: [headerRow, ...bodyRows]
    }
  };
}

/** A titled section wrapper used to group blocks on a page. */
export function section(title: string, children: ReportElement[]): ReportElement {
  return {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", gap: "10px", width: "100%" },
      children: [
        txt(title.toUpperCase(), {
          fontSize: "12px",
          fontWeight: 700,
          color: BRAND.blueDeep,
          letterSpacing: "1px"
        }),
        ...children
      ]
    }
  };
}

/** Small footer note (e.g. reversal note + verification line). */
export function footerNote(lines: string[]): ReportElement {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "2px",
        width: "100%",
        marginTop: "auto",
        paddingTop: "16px",
        borderTop: `1px solid ${BRAND.border}`
      },
      children: lines.map((l, i) =>
        txt(l, { fontSize: "10px", fontWeight: i === 0 ? 700 : 400, color: BRAND.muted })
      )
    }
  };
}

/**
 * Wrap a page's blocks in the standard Letter-size, white, padded container.
 * The renderer sizes the satori canvas to {@link PAGE_WIDTH} × {@link PAGE_HEIGHT}.
 */
export function page(children: ReportElement[]): ReportElement {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "22px",
        width: `${PAGE_WIDTH}px`,
        height: `${PAGE_HEIGHT}px`,
        backgroundColor: BRAND.white,
        padding: `${PAGE_PADDING}px`
      },
      children
    }
  };
}

/**
 * Max `dataTable` rows a page can hold before Yoga's flex-shrink pushes some
 * row/cell into degenerate (zero/negative) geometry that crashes the native
 * resvg rasterizer (issue #202 — an unrecoverable process abort, not a
 * catchable JS error). Calibrated empirically against a real render: with
 * `SINGLE_LINE_CLAMP` guaranteeing uniform row height, a page shaped like
 * brandHeader + one-row kpiGrid + table + footerNote (the common report
 * shape) crashes at 46 rows and is clean at 44; these constants stay well
 * under that with a safety margin so future block tweaks don't tip it over.
 * A page carrying a `verificationBanner` has less room (fewer rows fit); a
 * continuation page with no header/KPI/banner has more.
 */
export const TABLE_ROWS_FIRST_PAGE = 28;
export const TABLE_ROWS_FIRST_PAGE_WITH_BANNER = 20;
export const TABLE_ROWS_CONTINUATION_PAGE = 34;

/**
 * Row budget for a table with a `wrapLines`-bounded column (currently only
 * the defaulted report's Notas column, wrapLines: 4) — each row is roughly
 * 4x the height of a single-line row via `dataTable`'s fixed-row-height path,
 * so far fewer rows fit per page. Calibrated the same way as
 * {@link TABLE_ROWS_FIRST_PAGE}: empirically found the real crash boundary
 * (pathologically long notes — well beyond the ~110-char prompt target — on
 * every row, brandHeader+kpiGrid+table+footerNote layout): first-page-shaped
 * layout is clean at 22 rows and crashes at 23; a continuation-shaped layout
 * (no header/kpi/footer, more headroom) is clean at 25 and crashes at 26.
 * These constants stay well under both with the same ~35% margin
 * {@link TABLE_ROWS_FIRST_PAGE} uses. See
 * `mods/common/test/reporting/defaultedReport.test.ts` for the regression
 * test that exercises this boundary.
 */
export const TABLE_ROWS_FIRST_PAGE_NOTES = 14;
export const TABLE_ROWS_CONTINUATION_PAGE_NOTES = 18;

/**
 * Splits `rows` into page-sized chunks so a table's rows never overflow a
 * single fixed-height page (see {@link TABLE_ROWS_FIRST_PAGE} for why that
 * matters). The first chunk is capped at `firstPageMax`; every subsequent
 * chunk at `otherPagesMax` (a continuation page has more headroom since it
 * skips the brandHeader/kpiGrid/banner). Always returns at least one
 * (possibly empty) chunk so callers can render a table with zero rows.
 */
export function paginateRows<T>(
  rows: T[],
  firstPageMax: number,
  otherPagesMax: number = firstPageMax
): T[][] {
  if (rows.length === 0) return [[]];
  const pages: T[][] = [];
  let i = 0;
  let max = firstPageMax;
  while (i < rows.length) {
    pages.push(rows.slice(i, i + max));
    i += max;
    max = otherPagesMax;
  }
  return pages;
}
