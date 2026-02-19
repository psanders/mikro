/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Defaulted loans report layout for Satori: one table with name, phone, loanId, cycle, paid, AI summary.
 */
import { formatPaymentFrequency } from "../utils/customerReportHelpers.js";

export const DEFAULTED_REPORT_WIDTH = 900;

/** Base height per row when summary is short. */
const ROW_HEIGHT_BASE_PX = 44;
/** Extra height per line of wrapped summary (approx chars per line ~50). */
const SUMMARY_LINE_HEIGHT_PX = 20;
const CHARS_PER_LINE = 50;
/** Header + summary bar + content padding + footer. */
const BASE_HEIGHT_PX = 260;
const TABLE_HEADER_PX = 36;

export interface DefaultedReportRow {
  name: string;
  phone: string;
  loanId: number;
  paymentFrequency: string;
  totalPaid: number;
  summary: string;
}

type SatoriElement = {
  type: string;
  props: {
    [key: string]: unknown;
    style?: Record<string, unknown>;
    children?: unknown;
  };
};

function el(
  type: string,
  props: { style?: Record<string, unknown>; [key: string]: unknown },
  children?: unknown
): SatoriElement {
  const p: SatoriElement["props"] = { ...props };
  if (props.style) p.style = props.style;
  if (children !== undefined) p.children = children;
  return { type, props: p };
}

function formatDop(n: number): string {
  return `${n.toLocaleString("es-DO")} DOP`;
}

function tableHeader(): SatoriElement {
  return el(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "row",
        borderBottom: "2px solid #ccc",
        padding: "10px 12px",
        backgroundColor: "#f5f5f5",
        fontWeight: 700,
        fontSize: "14px",
        fontFamily: "Inter",
        color: "#333"
      }
    },
    [
      el("div", { style: { flex: 1.5, textAlign: "left" } }, "Nombre"),
      el("div", { style: { flex: 1.2, textAlign: "left" } }, "Teléfono"),
      el("div", { style: { flex: 0.7, textAlign: "right" } }, "Préstamo"),
      el("div", { style: { flex: 0.6, textAlign: "center" } }, "Ciclo"),
      el("div", { style: { flex: 0.8, textAlign: "right" } }, "Pagado"),
      el("div", { style: { flex: 2, textAlign: "left" } }, "Resumen")
    ]
  );
}

function defaultedRow(row: DefaultedReportRow): SatoriElement {
  return el(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "row",
        borderBottom: "1px solid #e8e8e8",
        padding: "10px 12px",
        fontSize: "14px",
        fontFamily: "Inter",
        color: "#444",
        alignItems: "flex-start"
      }
    },
    [
      el("div", { style: { flex: 1.5, textAlign: "left", overflow: "hidden" } }, row.name),
      el("div", { style: { flex: 1.2, textAlign: "left" } }, row.phone),
      el("div", { style: { flex: 0.7, textAlign: "right" } }, String(row.loanId)),
      el(
        "div",
        { style: { flex: 0.6, textAlign: "center" } },
        formatPaymentFrequency(row.paymentFrequency)
      ),
      el("div", { style: { flex: 0.8, textAlign: "right" } }, formatDop(row.totalPaid)),
      el(
        "div",
        {
          style: {
            flex: 2,
            textAlign: "left",
            flexWrap: "wrap",
            wordBreak: "break-word",
            whiteSpace: "normal",
            overflow: "hidden"
          }
        },
        row.summary || "Sin notas"
      )
    ]
  );
}

/**
 * Compute layout height from rows (summary text wrapping increases row height).
 */
export function getDefaultedReportHeight(rows: DefaultedReportRow[]): number {
  let totalRowsHeight = 0;
  for (const row of rows) {
    const summaryLines = Math.max(1, Math.ceil((row.summary?.length ?? 0) / CHARS_PER_LINE));
    totalRowsHeight += ROW_HEIGHT_BASE_PX + (summaryLines - 1) * SUMMARY_LINE_HEIGHT_PX;
  }
  return Math.max(1200, BASE_HEIGHT_PX + TABLE_HEADER_PX + totalRowsHeight);
}

/**
 * Creates the defaulted report layout for Satori.
 */
export function createDefaultedReportLayout(
  rows: DefaultedReportRow[],
  totalPrincipal: number,
  generatedAt: string,
  logoDataUrl?: string
): SatoriElement {
  const headerTextColumn = el(
    "div",
    {
      style: { display: "flex", flexDirection: "column", gap: "8px", flex: 1 }
    },
    [
      el(
        "div",
        {
          style: { fontSize: "26px", fontWeight: 700, fontFamily: "Inter" }
        },
        "Mikro Créditos — Reporte de Cartera en Default"
      ),
      el(
        "div",
        {
          style: { fontSize: "16px", fontWeight: 400, fontFamily: "Inter", opacity: 0.95 }
        },
        `${rows.length} préstamo${rows.length !== 1 ? "s" : ""} en default`
      )
    ]
  );

  const headerChildren: unknown[] = [headerTextColumn];
  if (logoDataUrl) {
    headerChildren.push(
      el("img", {
        src: logoDataUrl,
        width: 80,
        height: 80,
        style: {
          borderRadius: "12px",
          border: "2px solid rgba(255,255,255,0.4)",
          flexShrink: 0
        }
      })
    );
  }

  const header = el(
    "div",
    {
      style: {
        background: "linear-gradient(135deg, #1565a8 0%, #2980b9 100%)",
        color: "white",
        padding: "24px 28px",
        marginBottom: "20px",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: "16px"
      }
    },
    headerChildren
  );

  const summaryBar = el(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-around",
        padding: "14px 20px",
        margin: "0 20px 20px",
        backgroundColor: "white",
        borderRadius: "10px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.06)"
      }
    },
    [
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            fontSize: "14px",
            fontFamily: "Inter",
            color: "#666"
          }
        },
        [
          el(
            "div",
            { style: { fontWeight: 700, fontSize: "20px", color: "#e74c3c" } },
            String(rows.length)
          ),
          el("div", {}, "Préstamos en default")
        ]
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            fontSize: "14px",
            fontFamily: "Inter",
            color: "#666"
          }
        },
        [
          el(
            "div",
            { style: { fontWeight: 700, fontSize: "20px", color: "#333" } },
            formatDop(totalPrincipal)
          ),
          el("div", {}, "Principal en mora")
        ]
      )
    ]
  );

  const footer = el(
    "div",
    {
      style: {
        padding: "12px 28px",
        borderTop: "1px solid #e0e0e0",
        fontSize: "14px",
        fontFamily: "Inter",
        color: "#888"
      }
    },
    `Generado: ${generatedAt}`
  );

  const tableContent =
    rows.length === 0
      ? el(
          "div",
          {
            style: {
              padding: "24px",
              fontSize: "14px",
              fontFamily: "Inter",
              color: "#888",
              textAlign: "center"
            }
          },
          "No hay préstamos en default."
        )
      : [tableHeader(), ...rows.map(defaultedRow)];

  const content = el(
    "div",
    {
      style: {
        flex: 1,
        padding: "20px 20px 20px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "white",
        margin: "0 20px",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
      }
    },
    Array.isArray(tableContent) ? tableContent : [tableContent]
  );

  return el(
    "div",
    {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#f0f4f8",
        fontFamily: "Inter"
      }
    },
    [header, summaryBar, content, footer]
  );
}
