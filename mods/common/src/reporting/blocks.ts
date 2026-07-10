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
                  children: [txt("m", { fontSize: "34px", fontWeight: 900, color: BRAND.white })]
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

/** Data table with a header row and text status pills (no icons). */
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
        padding: "10px 12px",
        backgroundColor: BRAND.blueDeep,
        borderRadius: "8px 8px 0 0"
      },
      children: columns.map((col) => ({
        type: "div",
        props: {
          style: { display: "flex", justifyContent: justify(col.align), ...flexFor(col) },
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
        borderBottom: `1px solid ${BRAND.border}`
      },
      children: columns.map((col) => {
        const isStatus = r.status && r.status.column === col.key;
        return {
          type: "div",
          props: {
            style: { display: "flex", justifyContent: justify(col.align), ...flexFor(col) },
            children: [
              isStatus
                ? pill(r.status!.value, r.status!.tone ?? "upcoming")
                : txt(r.cells[col.key] ?? "", {
                    fontSize: "12px",
                    fontWeight: 400,
                    color: BRAND.ink
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
