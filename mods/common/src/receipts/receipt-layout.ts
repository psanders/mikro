/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ReceiptData } from "./jwt.js";

export interface ReceiptElement {
  type: string;
  props: {
    [key: string]: unknown;
    style?: Record<string, unknown>;
    children?: unknown;
  };
}

export const RECEIPT_WIDTH = 384;
export const RECEIPT_HEIGHT = 0;

function text(content: string, style: Record<string, unknown> = {}): ReceiptElement {
  return {
    type: "div",
    props: {
      style: { fontFamily: "Inter", ...style },
      children: content
    }
  };
}

function row(label: string, value: string): ReceiptElement {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        width: "100%"
      },
      children: [
        text(label, { fontSize: "13px", fontWeight: 400, color: "#5B6472" }),
        text(value, { fontSize: "13px", fontWeight: 700, color: "#14254A" })
      ]
    }
  };
}

function divider(): ReceiptElement {
  return {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "1px",
        backgroundColor: "#E0E6EF"
      }
    }
  };
}

function dashedDivider(): ReceiptElement {
  return {
    type: "div",
    props: {
      style: {
        width: "100%",
        borderBottom: "1px dashed #C0C8D4",
        height: "0px"
      }
    }
  };
}

/**
 * Thermal-printer-friendly receipt layout.
 * 384px wide (58mm thermal), no background, black on white.
 */
export function createReceiptLayout(
  data: ReceiptData,
  qrCodeDataUrl: string | null
): ReceiptElement {
  const {
    loanNumber = "",
    name = "",
    date = "",
    principalAmount,
    amountPaid = "RD$ 0.00",
    pendingPayments = 0,
    paymentNumber = "",
    method,
    agentName,
    feePaid,
    totalPaid
  } = data;

  const fields: Array<[string, string]> = [
    ["Préstamo", `#${loanNumber}`],
    ["Cliente", name],
    ["Fecha", date],
    ["No. de Pago", paymentNumber]
  ];
  if (method) {
    fields.push(["Método", method]);
  }
  if (principalAmount) {
    fields.push(["Capital", principalAmount]);
  }
  fields.push(["Cuota", amountPaid]);
  if (feePaid) {
    fields.push(["Mora", feePaid]);
  }
  if (totalPaid) {
    fields.push(["Total", totalPaid]);
  }
  fields.push(["Pagos Pendientes", String(pendingPayments)]);
  if (agentName) {
    fields.push(["Cobrador", agentName]);
  }

  const children: ReceiptElement[] = [
    // Header: brand mark
    {
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "4px",
          paddingTop: "20px",
          paddingBottom: "8px"
        },
        children: [
          text("mikro", {
            fontSize: "28px",
            fontWeight: 900,
            color: "#103A8A",
            letterSpacing: "-0.5px"
          }),
          text("RECIBO DE PAGO", {
            fontSize: "10px",
            fontWeight: 700,
            color: "#5B6472",
            letterSpacing: "2px"
          })
        ]
      }
    },

    dashedDivider(),

    // Amount highlight
    {
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "16px 0"
        },
        children: [
          text(totalPaid ?? feePaid ?? amountPaid, {
            fontSize: "32px",
            fontWeight: 900,
            color: "#103A8A"
          })
        ]
      }
    },

    divider(),

    // Detail rows
    {
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          padding: "14px 0"
        },
        children: fields.map(([label, value]) => row(label, value))
      }
    },

    dashedDivider()
  ];

  // QR code or unsigned placeholder
  if (qrCodeDataUrl) {
    children.push({
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "6px",
          padding: "14px 0 4px 0"
        },
        children: [
          {
            type: "img",
            props: {
              src: qrCodeDataUrl,
              width: 120,
              height: 120
            }
          },
          text("Escanea para verificar", {
            fontSize: "9px",
            color: "#8896AB"
          })
        ]
      }
    });
  } else {
    children.push({
      type: "div",
      props: {
        style: {
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "14px 0 4px 0"
        },
        children: [
          {
            type: "div",
            props: {
              style: {
                width: "120px",
                height: "120px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                border: "2px dashed #C0C8D4",
                borderRadius: "8px"
              },
              children: [
                text("SIN", { fontSize: "16px", fontWeight: 700, color: "#8896AB" }),
                text("FIRMA", { fontSize: "16px", fontWeight: 700, color: "#8896AB" }),
                text("DIGITAL", { fontSize: "16px", fontWeight: 700, color: "#8896AB" })
              ]
            }
          }
        ]
      }
    });
  }

  // Footer
  children.push({
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "8px 0 20px 0",
        gap: "2px"
      },
      children: [
        text("Gracias por su pago", {
          fontSize: "11px",
          fontWeight: 700,
          color: "#14254A"
        }),
        text("www.mikro.do", {
          fontSize: "10px",
          fontWeight: 600,
          color: "#103A8A"
        })
      ]
    }
  });

  return {
    type: "div",
    props: {
      style: {
        width: `${RECEIPT_WIDTH}px`,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#FFFFFF",
        padding: "0 20px"
      },
      children
    }
  };
}
