/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Accounting snapshot report layout for Satori: account balances + transaction ledger.
 */
import type { AccountingReportData } from "./types.js";
import { formatMoney } from "../utils/formatMoney.js";

export const ACCOUNTING_REPORT_WIDTH = 1000;

const ROW_HEIGHT_PX = 36;
const BASE_HEIGHT_PX = 420;
const TABLE_HEADER_PX = 36;
const BALANCE_ROW_PX = 36;
const SECTION_CHROME_PX = 80;

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
  return `${formatMoney(n)} DOP`;
}

function sectionTitle(title: string): SatoriElement {
  return el(
    "div",
    {
      style: {
        fontSize: "20px",
        fontWeight: 700,
        fontFamily: "Inter",
        color: "#1a5a96",
        marginBottom: "10px"
      }
    },
    title
  );
}

function tableRow(cells: string[], flexes: number[], header = false): SatoriElement {
  return el(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "row",
        borderBottom: "1px solid #e0e0e0",
        padding: "8px 10px",
        backgroundColor: header ? "#f5f5f5" : "white",
        fontWeight: header ? 700 : 400,
        fontSize: "14px",
        fontFamily: "Inter",
        color: header ? "#333" : "#444"
      }
    },
    cells.map((cell, i) =>
      el(
        "div",
        {
          style: {
            flex: flexes[i] ?? 1,
            textAlign: i === cells.length - 1 ? "right" : "left",
            overflow: "hidden"
          }
        },
        cell
      )
    )
  );
}

const ACCOUNT_KIND_LABELS: Record<string, string> = {
  BANK: "Banco",
  CASH: "Efectivo",
  CREDIT_CARD: "Tarjeta",
  OTHER: "Otro"
};

const TXN_TYPE_LABELS: Record<string, string> = {
  DEPOSIT: "Depósito",
  WITHDRAWAL: "Retiro",
  EXPENSE: "Gasto",
  INCOME: "Ingreso",
  TRANSFER: "Transferencia"
};

function summaryCard(label: string, value: string, color: string): SatoriElement {
  return el(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flex: 1,
        padding: "10px 8px"
      }
    },
    [
      el(
        "div",
        {
          style: {
            fontWeight: 700,
            fontSize: "18px",
            fontFamily: "Inter",
            color
          }
        },
        value
      ),
      el(
        "div",
        {
          style: {
            fontSize: "12px",
            fontFamily: "Inter",
            color: "#666",
            marginTop: "4px"
          }
        },
        label
      )
    ]
  );
}

/**
 * Compute the dynamic height based on the number of rows.
 */
export function getAccountingReportHeight(data: AccountingReportData): number {
  const balanceRows = data.accounts.length + 1; // +1 for totals
  const txnRows = data.transactions.length;
  const balanceHeight = TABLE_HEADER_PX + balanceRows * BALANCE_ROW_PX + SECTION_CHROME_PX;
  const txnHeight = TABLE_HEADER_PX + txnRows * ROW_HEIGHT_PX + SECTION_CHROME_PX;
  return Math.max(800, BASE_HEIGHT_PX + balanceHeight + txnHeight);
}

/**
 * Creates the accounting snapshot report layout for Satori.
 */
export function createAccountingReportLayout(
  data: AccountingReportData,
  generatedAt: string,
  logoDataUrl?: string
): SatoriElement {
  const { period, accounts, transactions, totals } = data;

  // --- Header ---
  const headerTextColumn = el(
    "div",
    {
      style: { display: "flex", flexDirection: "column", gap: "6px", flex: 1 }
    },
    [
      el(
        "div",
        {
          style: { fontSize: "24px", fontWeight: 700, fontFamily: "Inter" }
        },
        "Mikro Créditos — Reporte Contable"
      ),
      el(
        "div",
        {
          style: { fontSize: "16px", fontWeight: 400, fontFamily: "Inter", opacity: 0.95 }
        },
        `Periodo: ${period.startDate} a ${period.endDate}`
      )
    ]
  );

  const headerChildren: unknown[] = [headerTextColumn];
  if (logoDataUrl) {
    headerChildren.push(
      el("img", {
        src: logoDataUrl,
        width: 72,
        height: 72,
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

  // --- Summary bar ---
  const summaryBar = el(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-around",
        padding: "12px 16px",
        margin: "0 18px 16px",
        backgroundColor: "white",
        borderRadius: "8px",
        boxShadow: "0 2px 6px rgba(0,0,0,0.06)"
      }
    },
    [
      summaryCard("Ingresos", formatDop(totals.totalIncome), "#27ae60"),
      summaryCard("Gastos", formatDop(totals.totalExpenses), "#c0392b"),
      summaryCard(
        "Flujo neto",
        formatDop(totals.netFlow),
        totals.netFlow >= 0 ? "#27ae60" : "#c0392b"
      ),
      summaryCard("Balance total", formatDop(totals.combinedBalance), "#1565a8")
    ]
  );

  // --- Account balances section ---
  const balanceFlexes = [2, 1, 1];
  const balanceSection = el(
    "div",
    {
      style: {
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "white",
        margin: "0 18px 14px",
        borderRadius: "10px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
      }
    },
    [
      sectionTitle("Balance de cuentas"),
      tableRow(["Cuenta", "Tipo", "Balance (DOP)"], balanceFlexes, true),
      ...accounts.map((a) =>
        tableRow(
          [a.name, ACCOUNT_KIND_LABELS[a.kind] ?? a.kind, formatDop(a.currentBalance)],
          balanceFlexes
        )
      ),
      el(
        "div",
        {
          style: {
            display: "flex",
            flexDirection: "row",
            borderTop: "2px solid #ccc",
            padding: "10px 10px",
            fontWeight: 700,
            fontSize: "14px",
            fontFamily: "Inter",
            color: "#333"
          }
        },
        [
          el("div", { style: { flex: 2, textAlign: "left" } }, "Total"),
          el("div", { style: { flex: 1 } }),
          el("div", { style: { flex: 1, textAlign: "right" } }, formatDop(totals.combinedBalance))
        ]
      )
    ]
  );

  // --- Transaction ledger section ---
  const txnFlexes = [1, 1, 1.5, 1.2, 2, 1];
  const txnSection = el(
    "div",
    {
      style: {
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "white",
        margin: "0 18px 14px",
        borderRadius: "10px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
      }
    },
    [
      sectionTitle(`Transacciones del periodo (${transactions.length})`),
      ...(transactions.length === 0
        ? [
            el(
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
              "No hay transacciones en este periodo."
            )
          ]
        : [
            tableRow(
              ["Fecha", "Tipo", "Cuenta", "Categoría", "Descripción", "Monto (DOP)"],
              txnFlexes,
              true
            ),
            ...transactions.map((t) => {
              const label = t.vendor ?? t.description ?? "—";
              const displayLabel = label.length > 30 ? label.slice(0, 29) + "…" : label;
              return tableRow(
                [
                  t.occurredAt.slice(0, 10),
                  TXN_TYPE_LABELS[t.type] ?? t.type,
                  t.accountName,
                  t.categoryName ?? "—",
                  displayLabel,
                  formatDop(t.amount)
                ],
                txnFlexes
              );
            })
          ])
    ]
  );

  // --- Footer ---
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
      summaryBar,
      balanceSection,
      txnSection,
      { type: "div", props: { style: { flex: 1 } } },
      footer
    ]
  );
}
