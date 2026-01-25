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

/**
 * Receipt dimensions (matching background.png).
 */
export const RECEIPT_WIDTH = 1024;
export const RECEIPT_HEIGHT = 1536;

/**
 * Create the full receipt layout for Satori.
 */
export function createReceiptLayout(
  data: ReceiptData,
  qrCodeDataUrl: string | null,
  backgroundImage: string | null
): ReceiptElement {
  const {
    loanNumber = "123456",
    name = "John Doe",
    date = "24/04/2024",
    amountPaid = "RD$ 650",
    pendingPayments = 9,
    paymentNumber = "P1",
    agentName = "Nombre del Agente"
  } = data;

  // Updated fields: single "Nombre" row instead of separate firstName/lastName
  const fields: Array<[string, string]> = [
    ["Numero de Prestamo:", loanNumber],
    ["Nombre:", name],
    ["Fecha:", date],
    ["Monto Pagado:", amountPaid],
    ["Pagos Pendientes:", String(pendingPayments)],
    ["Numero de Pago:", paymentNumber],
    ["Agente:", agentName ?? ""]
  ];

  const backgroundStyle = backgroundImage
    ? {
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: "cover",
        backgroundPosition: "center"
      }
    : {
        background:
          "linear-gradient(180deg, #1565a8 0%, #2980b9 25%, #3498db 45%, #5dade2 65%, #48c9b0 80%, #d4a76a 90%, #e8c98a 100%)"
      };

  // QR Code element - either real QR or placeholder
  const qrCodeElement: ReceiptElement = qrCodeDataUrl
    ? {
        type: "img",
        props: {
          src: qrCodeDataUrl,
          width: 220,
          height: 220,
          style: {
            borderRadius: "8px"
          }
        }
      }
    : {
        type: "div",
        props: {
          style: {
            width: "220px",
            height: "220px",
            background: "#f5f5f5",
            border: "2px solid #e0e0e0",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          },
          children: {
            type: "div",
            props: {
              style: {
                fontSize: "16px",
                color: "#aaaaaa",
                fontFamily: "Inter"
              },
              children: "QR CODE"
            }
          }
        }
      };

  return {
    type: "div",
    props: {
      style: {
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        ...backgroundStyle
      },
      children: [
        // Spacer for header area
        {
          type: "div",
          props: {
            style: {
              height: "450px",
              display: "flex"
            }
          }
        },

        // Card
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              justifyContent: "center",
              paddingLeft: "45px",
              paddingRight: "45px"
            },
            children: {
              type: "div",
              props: {
                style: {
                  width: "100%",
                  background: "rgba(255, 255, 255, 0.75)",
                  borderRadius: "28px",
                  padding: "35px",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
                  display: "flex",
                  flexDirection: "column",
                  position: "relative"
                },
                children: [
                  // Fields (full width)
                  {
                    type: "div",
                    props: {
                      style: {
                        display: "flex",
                        flexDirection: "column",
                        gap: "24px"
                      },
                      children: fields.map(([label, value]) => ({
                        type: "div",
                        props: {
                          style: {
                            display: "flex",
                            flexDirection: "row",
                            gap: "12px"
                          },
                          children: [
                            {
                              type: "div",
                              props: {
                                style: {
                                  fontSize: "36px",
                                  fontWeight: 700,
                                  fontFamily: "Inter",
                                  color: "#1a5a96"
                                },
                                children: label
                              }
                            },
                            {
                              type: "div",
                              props: {
                                style: {
                                  fontSize: "36px",
                                  fontWeight: 400,
                                  fontFamily: "Inter",
                                  color: "#333333"
                                },
                                children: value
                              }
                            }
                          ]
                        }
                      }))
                    }
                  },
                  // QR Code (absolute positioned bottom-right)
                  {
                    type: "div",
                    props: {
                      style: {
                        display: "flex",
                        position: "absolute",
                        bottom: "35px",
                        right: "35px"
                      },
                      children: qrCodeElement
                    }
                  }
                ]
              }
            }
          }
        },

        // Spacer
        {
          type: "div",
          props: {
            style: {
              flex: 1,
              display: "flex"
            }
          }
        }
      ]
    }
  };
}
