/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Performance report layout for Satori: Loans Issued, Collection Status,
 * Financial Summary, and narrative sections with graphics.
 */
import type { PortfolioMetrics, ReportNarrative } from "./types.js";

export const REPORT_WIDTH = 1200;
export const REPORT_HEIGHT = 2600;

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

function formatPct(n: number): string {
  return `${n.toFixed(1)}%`;
}

function sectionTitle(title: string): SatoriElement {
  return el(
    "div",
    {
      style: {
        fontSize: "18px",
        fontWeight: 700,
        fontFamily: "Inter",
        color: "#1a5a96",
        marginBottom: "12px"
      }
    },
    title
  );
}

function tableRow(cells: string[], header = false): SatoriElement {
  return el(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "row",
        borderBottom: "1px solid #e0e0e0",
        padding: "10px 12px",
        backgroundColor: header ? "#f5f5f5" : "white",
        fontWeight: header ? 700 : 400,
        fontSize: header ? "13px" : "14px",
        fontFamily: "Inter",
        color: header ? "#333" : "#444"
      }
    },
    cells.map((cell, i) =>
      el(
        "div",
        {
          style: {
            flex: i === 0 ? 2 : 1,
            textAlign: i === 0 ? "left" : "right"
          }
        },
        cell
      )
    )
  );
}

/** Legend row: array of { color, label } */
function legendRow(items: Array<{ color: string; label: string }>): SatoriElement {
  return el(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "row",
        flexWrap: "wrap",
        marginTop: "10px",
        fontSize: "12px",
        fontFamily: "Inter",
        color: "#555"
      }
    },
    items.map(({ color, label }, idx) =>
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            marginRight: "20px",
            marginBottom: "4px"
          }
        },
        [
          el("div", {
            style: {
              width: "14px",
              height: "14px",
              borderRadius: "4px",
              backgroundColor: color,
              marginRight: "6px"
            }
          }),
          el("div", {}, label)
        ]
      )
    )
  );
}

/** Simple vertical bar chart: label + bar height by value. Uses explicit px heights for Satori. */
function verticalBarChart(
  items: Array<{ label: string; value: number; color: string }>,
  formatValue: (n: number) => string
): SatoriElement {
  const maxVal = Math.max(...items.map((i) => i.value), 1);
  const barMaxHeightPx = 100;
  return el(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "row",
        alignItems: "flex-end",
        marginTop: "16px",
        paddingTop: "8px",
        paddingBottom: "8px",
        borderWidth: "1px",
        borderStyle: "solid",
        borderColor: "#e8e8e8",
        borderRadius: "8px",
        backgroundColor: "#fafafa"
      }
    },
    items.map(({ label, value, color }) => {
      const barHeightPx =
        value > 0 ? Math.max(12, Math.round((value / maxVal) * barMaxHeightPx)) : 0;
      return el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            flex: 1,
            paddingLeft: "8px",
            paddingRight: "8px"
          }
        },
        [
          el(
            "div",
            {
              style: {
                fontSize: "12px",
                fontWeight: 600,
                fontFamily: "Inter",
                color: "#333",
                marginBottom: "6px"
              }
            },
            formatValue(value)
          ),
          el(
            "div",
            {
              style: {
                width: "60px",
                height: `${barMaxHeightPx}px`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                alignItems: "center"
              }
            },
            barHeightPx > 0
              ? el("div", {
                  style: {
                    width: "48px",
                    height: `${barHeightPx}px`,
                    backgroundColor: color,
                    borderRadius: "6px"
                  }
                })
              : el("div", { style: { width: "48px", height: "4px", backgroundColor: "#eee" } })
          ),
          el(
            "div",
            {
              style: {
                fontSize: "11px",
                fontFamily: "Inter",
                color: "#666",
                marginTop: "6px",
                textAlign: "center"
              }
            },
            label
          )
        ]
      );
    })
  );
}

/**
 * Creates the performance report layout for Satori.
 */
export function createPerformanceReportLayout(
  metrics: PortfolioMetrics,
  narrative: ReportNarrative,
  generatedAt: string
): SatoriElement {
  const {
    period,
    totalLoans,
    totalPrincipalDop,
    loansByStatus,
    loansBySize,
    totalExpectedRevenueDop,
    estimatedLossesPrincipalDop,
    estimatedRevenueLostDop,
    projectedCollectibleDop,
    projectedNetPositionDop,
    defaultRateByCountPct,
    defaultRateByCapitalPct,
    collectionRatePct
  } = metrics;

  const totalPrincipal = totalPrincipalDop || 1;
  const activePct = (loansByStatus.ACTIVE.principalDop / totalPrincipal) * 100;
  const completedPct = (loansByStatus.COMPLETED.principalDop / totalPrincipal) * 100;
  const defaultedPct = (loansByStatus.DEFAULTED.principalDop / totalPrincipal) * 100;

  const standardPct = (loansBySize.standard.principalDop / totalPrincipal) * 100;
  const largerPct = (loansBySize.larger.principalDop / totalPrincipal) * 100;
  const exceptionPct = (loansBySize.exception.principalDop / totalPrincipal) * 100;

  const header = el(
    "div",
    {
      style: {
        background: "linear-gradient(135deg, #1565a8 0%, #2980b9 100%)",
        color: "white",
        padding: "28px 40px",
        marginBottom: "32px",
        display: "flex",
        flexDirection: "column",
        gap: "8px"
      }
    },
    [
      el(
        "div",
        {
          style: { fontSize: "28px", fontWeight: 700, fontFamily: "Inter" }
        },
        "Mikro Créditos — Reporte de Rendimiento"
      ),
      el(
        "div",
        {
          style: { fontSize: "18px", fontWeight: 400, fontFamily: "Inter", opacity: 0.95 }
        },
        `Periodo: ${period.startDate} a ${period.endDate}`
      )
    ]
  );

  // --- Loans Issued ---
  const loansIssuedSection = el(
    "div",
    {
      style: {
        padding: "20px 40px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        background: "white",
        margin: "32px 40px 16px",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
      }
    },
    [
      sectionTitle("Préstamos emitidos"),
      tableRow(["Categoría", "Cantidad", "Principal desembolsado (DOP)"], true),
      tableRow([
        "Préstamos estándar (5,000 DOP)",
        String(loansBySize.standard.count),
        formatDop(loansBySize.standard.principalDop)
      ]),
      tableRow([
        "Préstamos mayores (10,000 DOP)",
        String(loansBySize.larger.count),
        formatDop(loansBySize.larger.principalDop)
      ]),
      tableRow([
        "Excepciones (8,000 y 20,000 DOP)",
        String(loansBySize.exception.count),
        formatDop(loansBySize.exception.principalDop)
      ]),
      tableRow(["Total portafolio", String(totalLoans), formatDop(totalPrincipalDop)]),
      el(
        "div",
        {
          style: {
            fontSize: "14px",
            fontWeight: 600,
            fontFamily: "Inter",
            color: "#333",
            marginTop: "14px"
          }
        },
        "Distribución por capital"
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "row",
            width: "100%",
            height: "24px",
            borderRadius: "6px",
            overflow: "hidden",
            backgroundColor: "#e0e0e0",
            marginTop: "6px"
          }
        },
        [
          standardPct > 0
            ? el("div", {
                style: { width: `${standardPct}%`, backgroundColor: "#3498db", height: "100%" }
              })
            : null,
          largerPct > 0
            ? el("div", {
                style: { width: `${largerPct}%`, backgroundColor: "#5dade2", height: "100%" }
              })
            : null,
          exceptionPct > 0
            ? el("div", {
                style: { width: `${exceptionPct}%`, backgroundColor: "#2980b9", height: "100%" }
              })
            : null
        ].filter((x): x is SatoriElement => x != null)
      ),
      legendRow([
        { color: "#3498db", label: "Estándar (5k)" },
        { color: "#5dade2", label: "Mayor (10k)" },
        { color: "#2980b9", label: "Excepción (8k/20k)" }
      ]),
      el(
        "div",
        {
          style: {
            fontSize: "14px",
            fontWeight: 600,
            fontFamily: "Inter",
            color: "#333",
            marginTop: "18px"
          }
        },
        "Principal por categoría"
      ),
      verticalBarChart(
        [
          { label: "Estándar", value: loansBySize.standard.principalDop, color: "#3498db" },
          { label: "Mayor", value: loansBySize.larger.principalDop, color: "#5dade2" },
          { label: "Excepción", value: loansBySize.exception.principalDop, color: "#2980b9" }
        ],
        formatDop
      )
    ]
  );

  // --- Collection Status (as of report date) ---
  const collectionStatusSection = el(
    "div",
    {
      style: {
        padding: "20px 40px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        background: "white",
        margin: "0 40px 16px",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
      }
    },
    [
      sectionTitle("Estado de cobranza (al cierre del reporte)"),
      tableRow(["Categoría", "Cantidad", "Principal (DOP)"], true),
      tableRow([
        "Completamente pagado",
        String(loansByStatus.COMPLETED.count),
        formatDop(loansByStatus.COMPLETED.principalDop)
      ]),
      tableRow([
        "Activo",
        String(loansByStatus.ACTIVE.count),
        formatDop(loansByStatus.ACTIVE.principalDop)
      ]),
      tableRow([
        "En mora",
        String(loansByStatus.DEFAULTED.count),
        formatDop(loansByStatus.DEFAULTED.principalDop)
      ]),
      tableRow(["Total", String(totalLoans), formatDop(totalPrincipalDop)]),
      el(
        "div",
        {
          style: {
            fontSize: "14px",
            fontWeight: 600,
            fontFamily: "Inter",
            color: "#333",
            marginTop: "14px"
          }
        },
        "Estado del portafolio (por capital)"
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "row",
            width: "100%",
            height: "28px",
            borderRadius: "6px",
            overflow: "hidden",
            backgroundColor: "#e0e0e0",
            marginTop: "6px"
          }
        },
        [
          completedPct > 0
            ? el("div", {
                style: { width: `${completedPct}%`, backgroundColor: "#2ecc71", height: "100%" }
              })
            : null,
          activePct > 0
            ? el("div", {
                style: { width: `${activePct}%`, backgroundColor: "#3498db", height: "100%" }
              })
            : null,
          defaultedPct > 0
            ? el("div", {
                style: { width: `${defaultedPct}%`, backgroundColor: "#e74c3c", height: "100%" }
              })
            : null
        ].filter((x): x is SatoriElement => x != null)
      ),
      legendRow([
        { color: "#2ecc71", label: "Completamente pagado" },
        { color: "#3498db", label: "Activo" },
        { color: "#e74c3c", label: "En mora" }
      ]),
      el(
        "div",
        {
          style: {
            fontSize: "14px",
            fontWeight: 600,
            fontFamily: "Inter",
            color: "#333",
            marginTop: "18px"
          }
        },
        "Principal por estado"
      ),
      verticalBarChart(
        [
          { label: "Pagado", value: loansByStatus.COMPLETED.principalDop, color: "#2ecc71" },
          { label: "Activo", value: loansByStatus.ACTIVE.principalDop, color: "#3498db" },
          { label: "En mora", value: loansByStatus.DEFAULTED.principalDop, color: "#e74c3c" }
        ],
        formatDop
      )
    ]
  );

  // --- Financial Summary ---
  const financialSummarySection = el(
    "div",
    {
      style: {
        padding: "20px 40px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "0",
        background: "white",
        margin: "0 40px 16px",
        borderRadius: "12px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
      }
    },
    [
      sectionTitle("Resumen financiero"),
      tableRow(["Métrica", "Monto"], true),
      tableRow(["Total principal desembolsado", formatDop(totalPrincipalDop)]),
      tableRow(["Total esperado (si todo se cobra)", formatDop(totalExpectedRevenueDop)]),
      tableRow(["Pérdidas estimadas (principal en mora)", formatDop(estimatedLossesPrincipalDop)]),
      tableRow([
        "Ingresos perdidos (principal + interés en mora)",
        formatDop(estimatedRevenueLostDop)
      ]),
      tableRow(["Ingresos cobrables proyectados", formatDop(projectedCollectibleDop)]),
      tableRow(["Posición neta proyectada", formatDop(projectedNetPositionDop)]),
      tableRow(["Tasa de mora (por cantidad)", formatPct(defaultRateByCountPct)]),
      tableRow(["Tasa de mora (por capital)", formatPct(defaultRateByCapitalPct)]),
      tableRow(["Tasa de cobro (proyectada)", formatPct(collectionRatePct)])
    ]
  );

  // --- Narrative ---
  const summarySection = el(
    "div",
    {
      style: {
        padding: "16px 40px 8px",
        display: "flex",
        flexDirection: "column",
        gap: "8px"
      }
    },
    [
      el(
        "div",
        {
          style: {
            fontSize: "16px",
            fontWeight: 700,
            fontFamily: "Inter",
            color: "#1a5a96"
          }
        },
        "Resumen ejecutivo"
      ),
      el(
        "div",
        {
          style: {
            fontSize: "14px",
            lineHeight: 1.5,
            fontFamily: "Inter",
            color: "#333"
          }
        },
        narrative.executiveSummary
      )
    ]
  );

  const insightsSection = narrative.keyInsights.length
    ? el(
        "div",
        {
          style: {
            padding: "8px 40px 8px",
            display: "flex",
            flexDirection: "column",
            gap: "6px"
          }
        },
        [
          el(
            "div",
            {
              style: {
                fontSize: "15px",
                fontWeight: 700,
                fontFamily: "Inter",
                color: "#333"
              }
            },
            "Puntos clave"
          ),
          ...narrative.keyInsights.slice(0, 3).map((insight) =>
            el(
              "div",
              {
                style: {
                  fontSize: "13px",
                  lineHeight: 1.4,
                  fontFamily: "Inter",
                  color: "#444",
                  paddingLeft: "14px",
                  borderLeft: "3px solid #3498db"
                }
              },
              insight
            )
          )
        ]
      )
    : null;

  const riskSection =
    narrative.riskAreas.length > 0
      ? el(
          "div",
          {
            style: {
              padding: "8px 40px 8px",
              display: "flex",
              flexDirection: "column",
              gap: "6px"
            }
          },
          [
            el(
              "div",
              {
                style: {
                  fontSize: "15px",
                  fontWeight: 700,
                  fontFamily: "Inter",
                  color: "#c62828"
                }
              },
              "Áreas de riesgo"
            ),
            ...narrative.riskAreas.slice(0, 3).map((risk) =>
              el(
                "div",
                {
                  style: {
                    fontSize: "13px",
                    lineHeight: 1.4,
                    fontFamily: "Inter",
                    color: "#555",
                    paddingLeft: "14px",
                    borderLeft: "3px solid #e74c3c"
                  }
                },
                risk
              )
            )
          ]
        )
      : null;

  const recommendationSection = el(
    "div",
    {
      style: {
        padding: "12px 40px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "6px"
      }
    },
    [
      el(
        "div",
        {
          style: {
            fontSize: "15px",
            fontWeight: 700,
            fontFamily: "Inter",
            color: "#2e7d32"
          }
        },
        "Recomendación"
      ),
      el(
        "div",
        {
          style: {
            fontSize: "13px",
            lineHeight: 1.4,
            fontFamily: "Inter",
            color: "#333"
          }
        },
        narrative.recommendation
      )
    ]
  );

  const footer = el(
    "div",
    {
      style: {
        padding: "12px 40px",
        borderTop: "1px solid #e0e0e0",
        fontSize: "12px",
        fontFamily: "Inter",
        color: "#888"
      }
    },
    `Generado: ${generatedAt}`
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
    [
      header,
      loansIssuedSection,
      collectionStatusSection,
      financialSummarySection,
      summarySection,
      insightsSection,
      riskSection,
      recommendationSection,
      { type: "div", props: { style: { flex: 1 } } },
      footer
    ].filter(Boolean)
  );
}
