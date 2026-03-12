/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Daily collections audit report layout for Satori: who was notified, message type, status, errors.
 */
import type { CollectionsAuditRow } from "./types.js";

export type { CollectionsAuditRow };
export const COLLECTIONS_AUDIT_REPORT_WIDTH = 1200;

const ROW_HEIGHT_PX = 40;
const BASE_HEIGHT_PX = 260;
const TABLE_HEADER_PX = 36;
const ERROR_CHARS_PER_LINE = 50;
const ERROR_LINE_HEIGHT_PX = 18;

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

function truncate(s: string, maxLen: number): string {
  if (!s) return "—";
  return s.length <= maxLen ? s : s.slice(0, maxLen - 1) + "…";
}

function tableHeader(): SatoriElement {
  return el(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "row",
        borderBottom: "2px solid #ccc",
        padding: "8px 10px",
        backgroundColor: "#f5f5f5",
        fontWeight: 700,
        fontSize: "12px",
        fontFamily: "Inter",
        color: "#333"
      }
    },
    [
      el("div", { style: { flex: 0.9, textAlign: "left" } }, "Hora"),
      el("div", { style: { flex: 1.2, textAlign: "left" } }, "Cliente"),
      el("div", { style: { flex: 0.5, textAlign: "right" } }, "Prést."),
      el("div", { style: { flex: 1.4, textAlign: "left" } }, "Tipo"),
      el("div", { style: { flex: 0.5, textAlign: "center" } }, "Estado"),
      el("div", { style: { flex: 2, textAlign: "left" } }, "Error / Notas")
    ]
  );
}

function auditRow(row: CollectionsAuditRow): SatoriElement {
  const sentAtShort = row.sentAt.slice(11, 19);
  const displayName =
    row.customerName.length > 18 ? row.customerName.slice(0, 17) + "…" : row.customerName;
  const errorText = truncate(row.notesOrError, 42);
  return el(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "row",
        borderBottom: "1px solid #e8e8e8",
        padding: "8px 10px",
        fontSize: "12px",
        fontFamily: "Inter",
        color: "#444",
        alignItems: "center"
      }
    },
    [
      el("div", { style: { flex: 0.9, textAlign: "left" } }, sentAtShort),
      el("div", { style: { flex: 1.2, textAlign: "left", overflow: "hidden" } }, displayName),
      el("div", { style: { flex: 0.5, textAlign: "right" } }, String(row.loanId)),
      el("div", { style: { flex: 1.4, textAlign: "left" } }, row.attemptType),
      el(
        "div",
        {
          style: {
            flex: 0.5,
            textAlign: "center",
            fontWeight: row.status === "FAILED" ? 600 : 400,
            color: row.status === "FAILED" ? "#c0392b" : "#27ae60"
          }
        },
        row.status === "FAILED" ? "Fallido" : "Enviado"
      ),
      el("div", { style: { flex: 2, textAlign: "left", overflow: "hidden" } }, errorText)
    ]
  );
}

/**
 * Compute layout height from rows.
 */
export function getCollectionsAuditReportHeight(rows: CollectionsAuditRow[]): number {
  let totalRowsHeight = TABLE_HEADER_PX;
  for (const r of rows) {
    const errorLines = r.notesOrError ? Math.ceil(r.notesOrError.length / ERROR_CHARS_PER_LINE) : 1;
    totalRowsHeight += Math.max(ROW_HEIGHT_PX, errorLines * ERROR_LINE_HEIGHT_PX);
  }
  return Math.max(800, BASE_HEIGHT_PX + totalRowsHeight);
}

/**
 * Creates the collections audit report layout for Satori.
 */
export function createCollectionsAuditReportLayout(
  rows: CollectionsAuditRow[],
  auditDateLabel: string,
  generatedAt: string,
  logoDataUrl?: string
): SatoriElement {
  const sentCount = rows.filter((r) => r.status === "SENT").length;
  const failedCount = rows.filter((r) => r.status === "FAILED").length;

  const headerTextColumn = el(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: "6px", flex: 1 } },
    [
      el(
        "div",
        { style: { fontSize: "22px", fontWeight: 700, fontFamily: "Inter" } },
        "Auditoría de Cobranza"
      ),
      el(
        "div",
        { style: { fontSize: "14px", fontWeight: 400, fontFamily: "Inter", opacity: 0.95 } },
        `Fecha: ${auditDateLabel} · ${rows.length} intento(s)`
      )
    ]
  );

  const headerChildren: unknown[] = [headerTextColumn];
  if (logoDataUrl) {
    headerChildren.push(
      el("img", {
        src: logoDataUrl,
        width: 64,
        height: 64,
        style: {
          borderRadius: "10px",
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
        padding: "20px 24px",
        marginBottom: "16px",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: "14px"
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
        padding: "12px 18px",
        margin: "0 18px 16px",
        backgroundColor: "white",
        borderRadius: "8px",
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
            fontSize: "12px",
            fontFamily: "Inter",
            color: "#666"
          }
        },
        [
          el(
            "div",
            { style: { fontWeight: 700, fontSize: "18px", color: "#27ae60" } },
            String(sentCount)
          ),
          el("div", {}, "Enviados")
        ]
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            fontSize: "12px",
            fontFamily: "Inter",
            color: "#666"
          }
        },
        [
          el(
            "div",
            { style: { fontWeight: 700, fontSize: "18px", color: "#c0392b" } },
            String(failedCount)
          ),
          el("div", {}, "Fallidos")
        ]
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            fontSize: "12px",
            fontFamily: "Inter",
            color: "#666"
          }
        },
        [
          el(
            "div",
            { style: { fontWeight: 700, fontSize: "18px", color: "#333" } },
            String(rows.length)
          ),
          el("div", {}, "Total")
        ]
      )
    ]
  );

  const footer = el(
    "div",
    {
      style: {
        padding: "10px 24px",
        borderTop: "1px solid #e0e0e0",
        fontSize: "12px",
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
              padding: "20px",
              fontSize: "14px",
              fontFamily: "Inter",
              color: "#888",
              textAlign: "center"
            }
          },
          "No hay intentos de cobranza para esta fecha."
        )
      : [tableHeader(), ...rows.map(auditRow)];

  const content = el(
    "div",
    {
      style: {
        flex: 1,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "white",
        margin: "0 18px",
        borderRadius: "10px",
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
