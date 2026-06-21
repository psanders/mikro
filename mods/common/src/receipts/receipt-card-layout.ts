/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ReceiptData } from "./jwt.js";
import type { ReceiptElement } from "./receipt-layout.js";

/**
 * Landscape "card" receipt sized for a WhatsApp template image header.
 * 1125×600 (~1.91:1) renders fully in the chat bubble without cropping.
 */
export const CARD_WIDTH = 1125;
export const CARD_HEIGHT = 600;

function text(content: string, style: Record<string, unknown> = {}): ReceiptElement {
  return {
    type: "div",
    props: {
      style: { fontFamily: "Inter", ...style },
      children: content
    }
  };
}

function cardRow(label: string, value: string): ReceiptElement {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "baseline",
        width: "100%"
      },
      children: [
        text(label, { fontSize: "18px", fontWeight: 400, color: "#5B6472" }),
        text(value, { fontSize: "18px", fontWeight: 700, color: "#14254A" })
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
        backgroundColor: "#E0E6EF",
        margin: "22px 0"
      }
    }
  };
}

/**
 * Build the landscape receipt card element tree.
 *
 * @param data - Receipt fields to render
 * @param qrCodeDataUrl - QR (data URL) encoding the signed token, or null when unsigned
 */
export function createReceiptCardLayout(
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

  const headlineAmount = totalPaid ?? feePaid ?? amountPaid;

  const fields: Array<[string, string]> = [
    ["Préstamo", `#${loanNumber}`],
    ["Cliente", name],
    ["Fecha", date]
  ];
  if (method) fields.push(["Método", method]);
  if (principalAmount) fields.push(["Capital", principalAmount]);
  if (amountPaid && amountPaid !== "RD$ 0.00") fields.push(["Monto Pagado", amountPaid]);
  if (feePaid) fields.push(["Mora", feePaid]);
  if (totalPaid) fields.push(["Total", totalPaid]);
  fields.push(["Pagos Pendientes", String(pendingPayments)]);
  fields.push(["No. de Pago", paymentNumber]);
  if (agentName) fields.push(["Cobrador", agentName]);

  // Left column: brand, headline amount, detail rows.
  const left: ReceiptElement = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        flex: 1,
        paddingRight: "48px"
      },
      children: [
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column" },
            children: [
              text("mikro", {
                fontSize: "46px",
                fontWeight: 900,
                color: "#14254A",
                letterSpacing: "-1px"
              }),
              text("RECIBO DE PAGO", {
                fontSize: "15px",
                fontWeight: 700,
                color: "#5B6472",
                letterSpacing: "4px",
                marginTop: "4px"
              })
            ]
          }
        },
        divider(),
        text(headlineAmount, { fontSize: "58px", fontWeight: 800, color: "#103A8A" }),
        divider(),
        {
          type: "div",
          props: {
            style: { display: "flex", flexDirection: "column", gap: "11px", width: "100%" },
            children: fields.map(([label, value]) => cardRow(label, value))
          }
        }
      ]
    }
  };

  // Right column: QR (or unsigned placeholder) + caption, separated by a rule.
  const qrBlock: ReceiptElement = qrCodeDataUrl
    ? {
        type: "img",
        props: { src: qrCodeDataUrl, width: 240, height: 240 }
      }
    : {
        type: "div",
        props: {
          style: {
            width: "240px",
            height: "240px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            border: "2px dashed #C0C8D4",
            borderRadius: "12px"
          },
          children: [
            text("SIN", { fontSize: "24px", fontWeight: 700, color: "#8896AB" }),
            text("FIRMA", { fontSize: "24px", fontWeight: 700, color: "#8896AB" }),
            text("DIGITAL", { fontSize: "24px", fontWeight: 700, color: "#8896AB" })
          ]
        }
      };

  const right: ReceiptElement = {
    type: "div",
    props: {
      style: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        width: "320px",
        borderLeft: "1px solid #E0E6EF",
        paddingLeft: "48px"
      },
      children: [
        qrBlock,
        text("Escanea para verificar", {
          fontSize: "16px",
          color: "#8896AB",
          marginTop: "16px"
        })
      ]
    }
  };

  return {
    type: "div",
    props: {
      style: {
        width: `${CARD_WIDTH}px`,
        height: `${CARD_HEIGHT}px`,
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        backgroundColor: "#FFFFFF",
        padding: "44px 56px"
      },
      children: [left, right]
    }
  };
}
