/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Customers report layout for Satori: grouped by payment health (Crítico, Requiere atención, Al día).
 */
import type { GroupedCustomerRows, GroupedCustomerRow } from "../utils/customerReportGrouping.js";
import { formatPaymentFrequency } from "../utils/customerReportHelpers.js";

/** Layout width in CSS px for Satori (room for Nombre + Apodo without excess empty space). */
export const CUSTOMERS_REPORT_WIDTH = 1040;

/** Approximate height per row in the layout. */
const ROW_HEIGHT_PX = 44;
/** Header + summary + content padding + footer overhead. */
const BASE_HEIGHT_PX = 260;
/** Height per section header (Crítico, Requiere atención, Al día). */
const SECTION_HEADER_PX = 48;
/** Height of the table header row (Nombre, Teléfono, etc.) per section. */
const TABLE_HEADER_PX = 36;
/** Margin below each section. */
const SECTION_MARGIN_PX = 20;
/** Space between the white content card and the footer rule (included in `getCustomersReportHeight`). */
const FOOTER_TOP_MARGIN_PX = 28;

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

const STAR = "★";

function ratingToStars(rating: 1 | 2 | 3 | 4 | 5): string {
  return STAR.repeat(rating);
}

function sectionHeader(title: string, count: number, bgColor: string): SatoriElement {
  return el(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 16px",
        backgroundColor: bgColor,
        borderRadius: "8px",
        marginBottom: "8px"
      }
    },
    [
      el(
        "div",
        {
          style: {
            fontSize: "18px",
            fontWeight: 700,
            fontFamily: "Inter",
            color: "#333"
          }
        },
        title
      ),
      el(
        "div",
        {
          style: {
            fontSize: "16px",
            fontWeight: 600,
            fontFamily: "Inter",
            color: "#555"
          }
        },
        `${count} préstamo${count !== 1 ? "s" : ""}`
      )
    ]
  );
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
      el("div", { style: { flex: 1.75, textAlign: "left" } }, "Nombre"),
      el("div", { style: { flex: 1.75, textAlign: "left" } }, "Apodo"),
      el("div", { style: { flex: 1.05, textAlign: "left" } }, "Teléfono"),
      el("div", { style: { flex: 0.7, textAlign: "right" } }, "Préstamo"),
      el("div", { style: { flex: 0.6, textAlign: "center" } }, "Ciclo"),
      el("div", { style: { flex: 0.7, textAlign: "center" } }, "Rating"),
      el("div", { style: { flex: 0.7, textAlign: "right" } }, "Pagos")
    ]
  );
}

function customerRow(row: GroupedCustomerRow): SatoriElement {
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
        alignItems: "center"
      }
    },
    [
      el(
        "div",
        {
          style: {
            flex: 1.75,
            textAlign: "left",
            overflow: "hidden",
            minWidth: 0
          }
        },
        row.name
      ),
      el(
        "div",
        {
          style: {
            flex: 1.75,
            textAlign: "left",
            overflow: "hidden",
            minWidth: 0,
            color: "#666"
          }
        },
        row.nickname?.trim() ?? ""
      ),
      el("div", { style: { flex: 1.05, textAlign: "left", minWidth: 0 } }, row.phone),
      el("div", { style: { flex: 0.7, textAlign: "right" } }, String(row.loanId)),
      el(
        "div",
        { style: { flex: 0.6, textAlign: "center" } },
        formatPaymentFrequency(row.paymentFrequency)
      ),
      el("div", { style: { flex: 0.7, textAlign: "center" } }, ratingToStars(row.rating)),
      el(
        "div",
        { style: { flex: 0.7, textAlign: "right" } },
        `${Math.min(row.paymentsMade, row.termLength)}/${row.termLength}`
      )
    ]
  );
}

function buildSection(
  title: string,
  rows: GroupedCustomerRow[],
  bgColor: string
): SatoriElement | null {
  if (rows.length === 0) return null;
  return el(
    "div",
    {
      style: {
        marginBottom: "20px",
        display: "flex",
        flexDirection: "column"
      }
    },
    [sectionHeader(title, rows.length, bgColor), tableHeader(), ...rows.map(customerRow)]
  );
}

/**
 * Compute layout height in pixels from grouped rows (for Satori viewport).
 */
export function getCustomersReportHeight(grouped: GroupedCustomerRows): number {
  const totalRows = grouped.critico.length + grouped.requiereAtencion.length + grouped.alDia.length;
  const sectionsWithRows =
    (grouped.critico.length ? 1 : 0) +
    (grouped.requiereAtencion.length ? 1 : 0) +
    (grouped.alDia.length ? 1 : 0);
  const sectionOverhead =
    sectionsWithRows * (SECTION_HEADER_PX + TABLE_HEADER_PX + SECTION_MARGIN_PX);
  return Math.max(
    1200,
    BASE_HEIGHT_PX + FOOTER_TOP_MARGIN_PX + sectionOverhead + totalRows * ROW_HEIGHT_PX
  );
}

/**
 * Creates the customers report layout for Satori.
 */
export function createCustomersReportLayout(
  grouped: GroupedCustomerRows,
  customerCount: number,
  loanCount: number,
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
        "mikro — Reporte de Clientes"
      ),
      el(
        "div",
        {
          style: { fontSize: "16px", fontWeight: 400, fontFamily: "Inter", opacity: 0.95 }
        },
        `${customerCount} clientes · ${loanCount} préstamos`
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
        background: "linear-gradient(135deg, #103A8A 0%, #1F4AA8 100%)",
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
            String(grouped.critico.length)
          ),
          el("div", {}, "Crítico")
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
            { style: { fontWeight: 700, fontSize: "20px", color: "#f39c12" } },
            String(grouped.requiereAtencion.length)
          ),
          el("div", {}, "Requiere atención")
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
            { style: { fontWeight: 700, fontSize: "20px", color: "#0E7C5F" } },
            String(grouped.alDia.length)
          ),
          el("div", {}, "Al día")
        ]
      )
    ]
  );

  const criticoSection = buildSection(
    "Crítico (requieren seguimiento)",
    grouped.critico,
    "#ffebee"
  );
  const requiereSection = buildSection("Requiere atención", grouped.requiereAtencion, "#fff8e1");
  const alDiaSection = buildSection("Al día", grouped.alDia, "#e8f5e9");

  const footer = el(
    "div",
    {
      style: {
        marginTop: `${FOOTER_TOP_MARGIN_PX}px`,
        padding: "14px 28px 12px",
        borderTop: "1px solid #e0e0e0",
        fontSize: "14px",
        fontFamily: "Inter",
        color: "#888"
      }
    },
    `Generado: ${generatedAt}`
  );

  const content = el(
    "div",
    {
      style: {
        flex: 1,
        padding: "20px 20px 28px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "white",
        margin: "0 20px",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
      }
    },
    [criticoSection, requiereSection, alDiaSection].filter((x): x is SatoriElement => x != null)
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
