/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Reusable satori layout blocks for the branded report PDF, matching the
 * Pencil-approved report redesign. Each block returns a plain element tree
 * (same shape the receipts layouts use) that the renderer feeds to satori →
 * SVG → PNG. Blocks are pure and composable; the report definitions assemble
 * them into pages, and `layout.ts` derives how much of each block a page can
 * carry before it overflows (see that file's header comment for why
 * overflow is not just a cosmetic bug here).
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

/** Mikro brand tokens (Pencil report redesign palette). */
export const BRAND = {
  blueDeep: "#103A8A",
  bluePrimary: "#1F4AA8",
  ink: "#14254A",
  mist: "#E9F2FF",
  orangePrimary: "#F68A1F",
  orangeDeep: "#E85B1C",
  white: "#FFFFFF",
  muted: "#697A93",
  border: "#E5EAF1",
  subtle: "#EEF3F9",
  green: "#16A34A",
  greenBg: "#E8F7EE",
  amber: "#D97706",
  amberBg: "#FDF1E3",
  red: "#DC2626",
  redBg: "#FCEBEB"
} as const;

/** US Letter portrait at 96dpi. Rendered at 2x by the renderer. */
export const PAGE_WIDTH = 816;
export const PAGE_HEIGHT = 1056;
/** Page padding on all four sides — see `layout.ts` for the derived safe-space model built on top of this. */
export const PAGE_PADDING = 44;
/** Vertical gap between a page's direct (top-level) children. */
export const PAGE_GAP = 22;

function txt(content: string, style: Record<string, unknown> = {}): ReportElement {
  return {
    type: "div",
    props: {
      style: { fontFamily: "Inter", display: "flex", ...style },
      children: content
    }
  };
}

/** One key/value (+ optional muted tail) meta row in the header's right column. */
export interface BrandHeaderMeta {
  label: string;
  value: string;
  tail?: string;
}

/**
 * Brand header: "m" tile + wordmark and title/subtitle on the left, a
 * right-aligned eyebrow + key/value meta rows on the right. No bottom rule —
 * the card borders elsewhere in the page carry the visual structure now.
 */
export function brandHeader(params: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  meta?: BrandHeaderMeta[];
}): ReportElement {
  const { eyebrow, title, subtitle, meta = [] } = params;

  const logoRow: ReportElement = {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "row", alignItems: "center", gap: "9px" },
      children: [
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "31px",
              height: "31px",
              borderRadius: "9px",
              backgroundColor: BRAND.bluePrimary
            },
            children: [
              txt("m", {
                fontSize: "18px",
                fontWeight: 700,
                color: BRAND.white,
                lineHeight: 1,
                // satori positions text on its baseline within the line box, so
                // an ascender/descender-free glyph like "m" sits visually low;
                // nudge it up to optically center it in the 31px tile (scaled
                // down from the previous 56px-tile/-6px calibration — verify
                // against a real render before trusting this in isolation).
                marginTop: "-3px"
              })
            ]
          }
        },
        txt("mikro", {
          fontSize: "24px",
          fontWeight: 700,
          color: BRAND.bluePrimary,
          letterSpacing: "-0.45px"
        })
      ]
    }
  };

  const titleBlock: ReportElement = {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", gap: "4px" },
      children: [
        txt(title, {
          fontSize: "27px",
          fontWeight: 700,
          color: BRAND.ink,
          letterSpacing: "-0.9px"
        }),
        subtitle
          ? txt(subtitle, { fontSize: "13px", fontWeight: 500, color: BRAND.muted })
          : txt("", { height: "0px" })
      ]
    }
  };

  const left: ReportElement = {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", gap: "16px" },
      children: [logoRow, titleBlock]
    }
  };

  const metaRows: ReportElement =
    meta.length > 0
      ? {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "4px" },
            children: meta.map((m) => ({
              type: "div",
              props: {
                style: { display: "flex", flexDirection: "row", alignItems: "center", gap: "5px" },
                children: [
                  txt(m.label, { fontSize: "12px", fontWeight: 500, color: BRAND.muted }),
                  txt(m.value, { fontSize: "12px", fontWeight: 700, color: BRAND.ink }),
                  m.tail
                    ? txt(m.tail, { fontSize: "12px", fontWeight: 500, color: BRAND.muted })
                    : txt("", { height: "0px" })
                ]
              }
            }))
          }
        }
      : txt("", { height: "0px" });

  const right: ReportElement = {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "9px" },
      children: [
        eyebrow
          ? txt(eyebrow.toUpperCase(), {
              fontSize: "10px",
              fontWeight: 700,
              color: BRAND.muted,
              letterSpacing: "1.8px"
            })
          : txt("", { height: "0px" }),
        metaRows
      ]
    }
  };

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        width: "100%"
      },
      children: [left, right]
    }
  };
}

/**
 * Verification / notice banner: a small tone-colored dot + bold headline,
 * then a muted explanation line (1-2 lines). `tone` only changes color
 * (pass/info both read as the brand mist card; fail switches to the red
 * tones) — the shape is identical either way.
 */
export function verificationBanner(params: {
  headline: string;
  explanation: string;
  tone?: "pass" | "fail" | "info";
}): ReportElement {
  const { headline, explanation, tone = "info" } = params;
  const bg = tone === "fail" ? BRAND.redBg : BRAND.mist;
  const dot = tone === "fail" ? BRAND.red : BRAND.bluePrimary;
  const headlineColor = tone === "fail" ? BRAND.red : BRAND.ink;

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        width: "100%",
        padding: "14px 16px",
        borderRadius: "11px",
        backgroundColor: bg
      },
      children: [
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "row", alignItems: "center", gap: "7px" },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    width: "6px",
                    height: "6px",
                    borderRadius: "999px",
                    backgroundColor: dot
                  },
                  children: []
                }
              },
              txt(headline, { fontSize: "12px", fontWeight: 700, color: headlineColor })
            ]
          }
        },
        txt(explanation, { fontSize: "11px", fontWeight: 500, color: BRAND.muted, lineHeight: 1.4 })
      ]
    }
  };
}

/**
 * Plain tinted note card — a mist-background rounded box for free-flowing
 * secondary content that doesn't fit `verificationBanner`'s dot+headline
 * shape (e.g. a reconciliation explanation, a narrative recommendation).
 */
export function noteCard(params: { heading?: string; lines: string[] }): ReportElement {
  const { heading, lines } = params;
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        width: "100%",
        padding: "14px 16px",
        borderRadius: "11px",
        backgroundColor: BRAND.mist
      },
      children: [
        heading
          ? txt(heading, { fontSize: "12px", fontWeight: 700, color: BRAND.ink })
          : txt("", { height: "0px" }),
        ...lines.map((l) =>
          txt(l, { fontSize: "11px", fontWeight: 500, color: BRAND.ink, lineHeight: 1.4 })
        )
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
  /** Status pill rendered under the value — for state the figure alone can't convey. */
  pill?: { value: string; tone: PillTone };
}

/** Bordered card of KPI cells — `columns` per row, internal dividers between cells and rows. */
export function kpiGrid(params: { cells: KpiCell[]; columns?: number }): ReportElement {
  const { cells, columns = 4 } = params;
  const rows: KpiCell[][] = [];
  for (let i = 0; i < cells.length; i += columns) rows.push(cells.slice(i, i + columns));

  const cell = (c: KpiCell, isLastInRow: boolean): ReportElement => ({
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: "5px",
        flexGrow: 1,
        flexBasis: "0px",
        // Flex items default to `min-width: auto` (their content's intrinsic
        // width), which lets a wide value overflow its cell instead of
        // wrapping — and because the whole grid has `overflow: hidden` for
        // its rounded corners, an overflowing value silently gets clipped
        // rather than visibly breaking. `minWidth: 0` is what actually lets
        // text wrap within the cell's real (flex-allotted) width.
        minWidth: "0px",
        padding: "15px 16px",
        ...(isLastInRow ? {} : { borderRight: `1px solid ${BRAND.border}` })
      },
      children: [
        txt(c.label.toUpperCase(), {
          fontSize: "10px",
          fontWeight: 700,
          color: BRAND.muted,
          letterSpacing: "0.9px"
        }),
        // 19px (Pencil specs 22 at its 900px canvas): the KPI figures carry
        // two decimals (e.g. RD$10,037.50) and at 22px they run nearly
        // edge-to-edge in a 4-across cell — user asked to keep the decimals
        // and size the number down instead.
        txt(c.value, {
          fontSize: "19px",
          fontWeight: 700,
          color: c.emphasize ? BRAND.orangeDeep : BRAND.ink,
          letterSpacing: "-0.4px",
          width: "100%",
          minWidth: "0px"
        }),
        // Spread rather than a zero-height placeholder: the cell has `gap`, which
        // applies between every child, so an empty node would still add 5px to
        // each cell of every kpiGrid in every report.
        ...(c.pill ? [pill(c.pill.value, c.pill.tone)] : []),
        c.subtext
          ? txt(c.subtext, {
              fontSize: "11px",
              fontWeight: 500,
              color: BRAND.muted,
              lineHeight: 1.3
            })
          : txt("", { height: "0px" })
      ]
    }
  });

  const rowEls: ReportElement[] = rows.map((rowCells, ri) => ({
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "row",
        width: "100%",
        ...(ri === rows.length - 1 ? {} : { borderBottom: `1px solid ${BRAND.border}` })
      },
      children: rowCells.map((c, ci) => cell(c, ci === rowCells.length - 1))
    }
  }));

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        border: `1px solid ${BRAND.border}`,
        borderRadius: "11px",
        backgroundColor: BRAND.white,
        overflow: "hidden"
      },
      children: rowEls
    }
  };
}

/** Text weight/color treatment for a `dataTable` body cell (default `"secondary"`). */
export type CellVariant = "primary" | "secondary" | "money" | "moneyEmphasis" | "moneyMuted";

function variantStyle(variant: CellVariant): Record<string, unknown> {
  switch (variant) {
    case "primary":
      return { fontWeight: 600, color: BRAND.ink };
    case "money":
      return { fontWeight: 600, color: BRAND.ink };
    case "moneyEmphasis":
      return { fontWeight: 600, color: BRAND.orangeDeep };
    case "moneyMuted":
      return { fontWeight: 500, color: BRAND.muted };
    case "secondary":
    default:
      return { fontWeight: 500, color: BRAND.muted };
  }
}

/** A table column definition. */
export interface TableColumn {
  key: string;
  header: string;
  /** flex weight for column width. */
  weight?: number;
  align?: "left" | "right" | "center";
  /** Default cell treatment for this column (overridable per-row via `TableRow.cellVariants`). */
  variant?: CellVariant;
}

export type PillTone = "paid" | "partial" | "overdue" | "upcoming" | "dueToday" | "info";

/** A table row: cell text keyed by column, plus an optional status pill value. */
export interface TableRow {
  cells: Record<string, string>;
  /** When set, this column key renders as a text status pill. */
  status?: {
    column: string;
    value: string;
    tone?: PillTone;
  };
  /** Per-row override of a column's default `variant` (e.g. a RD$0.00 "aplicado" cell reads muted while a real amount reads as money). */
  cellVariants?: Partial<Record<string, CellVariant>>;
  /** Soft amber tint for a row that needs attention (e.g. the loan-statement's partial cuota). */
  highlight?: boolean;
}

const PILL_TONES: Record<PillTone, { bg: string; fg: string }> = {
  paid: { bg: BRAND.greenBg, fg: BRAND.green },
  partial: { bg: BRAND.amberBg, fg: BRAND.amber },
  overdue: { bg: BRAND.redBg, fg: BRAND.red },
  upcoming: { bg: BRAND.subtle, fg: BRAND.muted },
  // Yellow (loan-statement "Vence hoy" — due today, distinct from red "Sin pago").
  dueToday: { bg: "#FFF6D9", fg: "#8A6A00" },
  info: { bg: BRAND.mist, fg: BRAND.bluePrimary }
};

function pill(value: string, tone: PillTone): ReportElement {
  const c = PILL_TONES[tone] ?? PILL_TONES.upcoming;
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        alignSelf: "flex-start",
        padding: "4px 9px",
        borderRadius: "999px",
        backgroundColor: c.bg
      },
      children: [txt(value, { fontSize: "11px", fontWeight: 600, color: c.fg })]
    }
  };
}

/**
 * Forces a cell's text onto a single line (no wrap), clipping overflow with
 * an ellipsis instead of letting the line grow the row's height. Every body
 * row now has a fixed height by construction (no `wrapLines` escape hatch —
 * removed; free-text content like the defaulted report's notes lives in its
 * own paginated section instead of a table column), so this clamp is what
 * keeps that fixed height honest for pathologically long cell values.
 */
const SINGLE_LINE_CLAMP: Record<string, unknown> = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  minWidth: "0px"
};

/**
 * Data table: white-background header (no more blue band), bordered card
 * wrapper, no zebra striping, per-column text `variant`, optional per-row
 * highlight tint. See `layout.ts`'s `TABLE_ROW_HEIGHT` for the fixed row
 * height this shape guarantees (uniform single-line rows keep the
 * `paginateRows` budget reliable — see that file's header comment for why).
 */
export function dataTable(params: { columns: TableColumn[]; rows: TableRow[] }): ReportElement {
  const { columns, rows } = params;
  const flexFor = (col: TableColumn) => ({ flexGrow: col.weight ?? 1, flexBasis: "0px" });
  const justify = (align?: string) =>
    align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start";

  const headerRow: ReportElement = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "row",
        width: "100%",
        gap: "16px",
        padding: "10px 15px",
        backgroundColor: BRAND.white,
        borderBottom: `1px solid ${BRAND.border}`
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
              color: BRAND.muted,
              letterSpacing: "0.55px"
            })
          ]
        }
      }))
    }
  };

  const bodyRows: ReportElement[] = rows.map((r, i) => {
    const isLast = i === rows.length - 1;
    return {
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "row",
          width: "100%",
          gap: "16px",
          padding: "10px 15px",
          backgroundColor: r.highlight ? "#FEF8EF" : BRAND.white,
          ...(isLast ? {} : { borderBottom: `1px solid ${BRAND.border}` })
        },
        children: columns.map((col) => {
          const isStatus = r.status && r.status.column === col.key;
          const variant = r.cellVariants?.[col.key] ?? col.variant ?? "secondary";
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
                      width: "100%",
                      // The cell's text box is stretched to the full column
                      // width (needed for SINGLE_LINE_CLAMP's ellipsis to
                      // have something to clip against) — once it is, the
                      // OUTER wrapper's justifyContent has no free space left
                      // to position against, so alignment must also be set
                      // here, on the text box itself, or a right/center
                      // column silently renders left-aligned.
                      justifyContent: justify(col.align),
                      textAlign: col.align ?? "left",
                      ...variantStyle(variant),
                      ...SINGLE_LINE_CLAMP
                    })
              ]
            }
          };
        })
      }
    };
  });

  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        width: "100%",
        border: `1px solid ${BRAND.border}`,
        borderRadius: "11px",
        backgroundColor: BRAND.white,
        overflow: "hidden"
      },
      children: [headerRow, ...bodyRows]
    }
  };
}

/**
 * A titled section wrapper used to group blocks on a page. Title is
 * sentence case as supplied by the caller — this block does NOT uppercase it
 * (the old all-caps section title is gone; callers pass already-correct
 * copy). `annotation` is an optional right-aligned hint (e.g. the loan
 * statement's "Cubierta el" explainer next to "Calendario de pagos").
 */
export function section(
  title: string,
  children: ReportElement[],
  opts?: { annotation?: string }
): ReportElement {
  const titleRow: ReportElement = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
        width: "100%"
      },
      children: [
        txt(title, {
          fontSize: "16px",
          fontWeight: 700,
          color: BRAND.ink,
          letterSpacing: "-0.3px"
        }),
        opts?.annotation
          ? {
              type: "div",
              props: {
                style: {
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  maxWidth: "260px"
                },
                children: [
                  txt(opts.annotation, {
                    fontSize: "10px",
                    fontWeight: 500,
                    color: BRAND.muted,
                    lineHeight: 1.3,
                    textAlign: "right"
                  })
                ]
              }
            }
          : txt("", { height: "0px" })
      ]
    }
  };

  return {
    type: "div",
    props: {
      style: { display: "flex", flexDirection: "column", gap: "10px", width: "100%" },
      children: [titleRow, ...children]
    }
  };
}

/**
 * Page footer, pinned to the bottom via `marginTop: auto`. Every page gets
 * one, including single-page documents ("Página 1 de 1") — page numbers are
 * a hard requirement, not a nicety reserved for multi-page docs, so callers
 * must always pass `page`/`pages` rather than only on overflow.
 */
export function pageFooter(params: { left: string[]; page: number; pages: number }): ReportElement {
  const { left, page, pages } = params;
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
        width: "100%",
        marginTop: "auto",
        paddingTop: "10px",
        borderTop: `1px solid ${BRAND.border}`
      },
      children: [
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "2px" },
            children: left.map((l) =>
              txt(l, { fontSize: "10px", fontWeight: 500, color: BRAND.muted })
            )
          }
        },
        txt(`Página ${page} de ${pages}`, { fontSize: "10px", fontWeight: 500, color: BRAND.muted })
      ]
    }
  };
}

/**
 * Wrap a page's blocks in the standard Letter-size, white, padded container.
 * The renderer sizes the satori canvas to {@link PAGE_WIDTH} × {@link PAGE_HEIGHT}.
 * Top-level children are separated by {@link PAGE_GAP} — see `layout.ts` for
 * why every block on this page must add up to at or under the page height.
 */
export function page(children: ReportElement[]): ReportElement {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        gap: `${PAGE_GAP}px`,
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
 * Splits `rows` into page-sized chunks so a table's rows never overflow a
 * single fixed-height page (see `layout.ts`'s `tableRowBudget` for how
 * callers derive `firstPageMax`/`otherPagesMax` from real block geometry
 * instead of a hand-tuned constant). The first chunk is capped at
 * `firstPageMax`; every subsequent chunk at `otherPagesMax`. Always returns
 * at least one (possibly empty) chunk so callers can render a table with
 * zero rows.
 */
export function paginateRows<T>(
  rows: T[],
  firstPageMax: number,
  otherPagesMax: number = firstPageMax
): T[][] {
  if (rows.length === 0) return [[]];
  const pages: T[][] = [];
  let i = 0;
  let max = Math.max(1, firstPageMax);
  while (i < rows.length) {
    pages.push(rows.slice(i, i + max));
    i += max;
    max = Math.max(1, otherPagesMax);
  }
  return pages;
}
