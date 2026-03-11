/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Renewal candidates report layout: near-completion and completed loans with rating and AI note.
 * Structure mirrors the defaulted report (header, summary bar, table, footer).
 */
import { formatPaymentFrequency } from "../utils/customerReportHelpers.js";

export const RENEWAL_REPORT_WIDTH = 1400;

const ROW_HEIGHT_BASE_PX = 44;
const NOTE_LINE_HEIGHT_PX = 20;
/**
 * Note column is flex:4.2 of ~10 total = ~42% of ~1360 px = ~571 px.
 * At 14 px Inter that fits roughly 85 characters per line.
 */
const CHARS_PER_LINE = 85;
const BASE_HEIGHT_PX = 340;
const TABLE_HEADER_PX = 36;

export interface RenewalReportRow {
  name: string;
  phone: string;
  loanId: number;
  paymentFrequency: string;
  paymentsMade: number;
  termLength: number;
  paymentRating: number;
  candidateNote: string;
  isCompleted: boolean;
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

const STAR = "\u2605";

function ratingToStars(rating: number): string {
  return STAR.repeat(rating);
}

function ratingColor(rating: number): string {
  if (rating >= 4) return "#27ae60";
  if (rating >= 3) return "#f39c12";
  return "#e74c3c";
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
      el("div", { style: { flex: 1.3, textAlign: "left" } }, "Nombre"),
      el("div", { style: { flex: 1, textAlign: "left" } }, "Teléfono"),
      el("div", { style: { flex: 0.6, textAlign: "right" } }, "Préstamo"),
      el("div", { style: { flex: 0.8, textAlign: "center" } }, "Frecuencia"),
      el("div", { style: { flex: 0.5, textAlign: "center" } }, "Cuotas"),
      el("div", { style: { flex: 0.7, textAlign: "center" } }, "Calif."),
      el("div", { style: { flex: 0.9, textAlign: "center" } }, "Estado"),
      el("div", { style: { flex: 4.2, textAlign: "left" } }, "Nota de renovación")
    ]
  );
}

function renewalRow(row: RenewalReportRow): SatoriElement {
  const estado = row.isCompleted ? "Completado" : "Activo";
  const cuotas = `${row.paymentsMade}/${row.termLength}`;

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
      el("div", { style: { flex: 1.3, textAlign: "left", overflow: "hidden" } }, row.name),
      el("div", { style: { flex: 1, textAlign: "left" } }, row.phone),
      el("div", { style: { flex: 0.6, textAlign: "right" } }, String(row.loanId)),
      el(
        "div",
        { style: { flex: 0.8, textAlign: "center" } },
        formatPaymentFrequency(row.paymentFrequency)
      ),
      el("div", { style: { flex: 0.5, textAlign: "center" } }, cuotas),
      el(
        "div",
        {
          style: {
            flex: 0.7,
            textAlign: "center",
            color: ratingColor(row.paymentRating)
          }
        },
        ratingToStars(row.paymentRating)
      ),
      el(
        "div",
        {
          style: {
            flex: 0.9,
            textAlign: "center",
            fontWeight: row.isCompleted ? 600 : 400,
            color: row.isCompleted ? "#27ae60" : "#3498db"
          }
        },
        estado
      ),
      el(
        "div",
        {
          style: {
            flex: 4.2,
            textAlign: "left",
            flexWrap: "wrap",
            wordBreak: "break-word",
            whiteSpace: "normal",
            overflow: "hidden"
          }
        },
        row.candidateNote || "—"
      )
    ]
  );
}

export function getRenewalReportHeight(rows: RenewalReportRow[]): number {
  let totalRowsHeight = 0;
  for (const row of rows) {
    const noteLines = Math.max(1, Math.ceil((row.candidateNote?.length ?? 0) / CHARS_PER_LINE));
    totalRowsHeight += ROW_HEIGHT_BASE_PX + (noteLines - 1) * NOTE_LINE_HEIGHT_PX;
  }
  return Math.max(1200, BASE_HEIGHT_PX + TABLE_HEADER_PX + totalRowsHeight);
}

export function createRenewalReportLayout(
  rows: RenewalReportRow[],
  generatedAt: string,
  logoDataUrl?: string
): SatoriElement {
  const completedCount = rows.filter((r) => r.isCompleted).length;
  const activeCount = rows.length - completedCount;
  const avgRating =
    rows.length > 0
      ? (rows.reduce((s, r) => s + r.paymentRating, 0) / rows.length).toFixed(1)
      : "—";

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
        "Mikro Créditos — Reporte de Renovación"
      ),
      el(
        "div",
        {
          style: { fontSize: "16px", fontWeight: 400, fontFamily: "Inter", opacity: 0.95 }
        },
        `${rows.length} préstamo${rows.length !== 1 ? "s" : ""} elegibles (${completedCount} completados, ${activeCount} por terminar)`
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
            { style: { fontWeight: 700, fontSize: "20px", color: "#27ae60" } },
            String(completedCount)
          ),
          el("div", {}, "Completados")
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
            { style: { fontWeight: 700, fontSize: "20px", color: "#3498db" } },
            String(activeCount)
          ),
          el("div", {}, "Por terminar")
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
          el("div", { style: { fontWeight: 700, fontSize: "20px", color: "#333" } }, avgRating),
          el("div", {}, "Calif. promedio")
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
          "No hay préstamos cerca de terminar o completados."
        )
      : [tableHeader(), ...rows.map(renewalRow)];

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
