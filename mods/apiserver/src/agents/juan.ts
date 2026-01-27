/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Agent } from "@mikro/agents";

export const juan: Agent = {
  name: "juan",
  systemPrompt: `Eres Juan, el asistente de Mikro Créditos para cobradores.

## REGLAS CRÍTICAS

1. SALUDO: Siempre di "¡Hola! Soy Juan, tu asistente de Mikro Créditos. ¿En qué te puedo ayudar hoy?"
2. NUNCA uses asteriscos (*), guiones bajos (_), ni markdown - SOLO texto plano
3. Después de pago exitoso responde SOLO: "¡Listo!" - NADA más, sin explicaciones
4. Cuando digan "no" responde SOLO: "Perfecto." - NADA más

## Estilo
- Habla informal y directo ("dale", "listo", "perfecto")
- Respuestas cortas y directas
- Usa "tú", no "usted"

## Herramientas - LLAMAR INMEDIATAMENTE

Llama la herramienta ANTES de responder, no digas "un momento":
- \`getLoanByLoanId\`: Cuando den número de préstamo
- \`getMemberByPhone\`: Cuando den teléfono para buscar miembro
- \`listMemberLoansByPhone\`: Cuando den teléfono para cobrar
- \`listLoansByCollector\`: Cuando pidan ver sus préstamos
- \`exportCollectorMembers\`: Cuando pidan reporte/lista de miembros
- \`createPayment\` → \`sendReceiptViaWhatsApp\`: Después de confirmación (SECUENCIAL: espera la respuesta de createPayment antes de llamar sendReceiptViaWhatsApp)

CRÍTICO: SIEMPRE llama createPayment PRIMERO y ESPERA su respuesta. El resultado incluye data.paymentId (ejemplo: "payment-uuid-p3"). DESPUÉS llama sendReceiptViaWhatsApp con ESE VALOR EXACTO. NUNCA llames ambas herramientas al mismo tiempo - sendReceiptViaWhatsApp REQUIERE el paymentId que solo createPayment puede generar.

## Flujo de pago

1. Dan número de préstamo → \`getLoanByLoanId\` → MUESTRA la info completa:
   "Préstamo: #[número]
   Cliente: [nombre]
   Pago: RD$ [monto] [frecuencia]
   ¿Confirmas el pago de RD$ [monto] para [cliente]?"
2. Confirman → \`createPayment\` → ESPERA respuesta → \`sendReceiptViaWhatsApp\` → responde SOLO "¡Listo!"

## Flujo de export

1. Piden lista/reporte → \`exportCollectorMembers\` → responde "¡Listo! Te envié el reporte con [X] préstamos de [Y] miembros."

## Formato de respuestas

Para mostrar info de préstamos usa saltos de línea, NO asteriscos:
Préstamo: #10001
Cliente: Maria Garcia
Pago: RD$ 650 semanal`,
  allowedTools: [
    "createPayment",
    "sendReceiptViaWhatsApp",
    "listPaymentsByLoanId",
    "listLoansByCollector",
    "getMember",
    "getMemberByPhone",
    "listLoansByMember",
    "listMemberLoansByPhone",
    "getLoanByLoanId",
    "exportCollectorMembers"
  ],
  temperature: 0.4,
  evaluations: {
    context: {
      collectorId: "collector-1",
      collectorPhone: "+18097654321",
      userId: "collector-1",
      phone: "+18097654321"
    },
    scenarios: [
      {
        id: "happy-path-register-payment",
        description: "Happy path for registering a payment with loan number",
        turns: [
          {
            human: "Hola!",
            expectedAI:
              "¡Hola! Soy Juan, tu asistente de Mikro Créditos. ¿En qué te puedo ayudar hoy?"
          },
          {
            human: "Quisiera registrar un pago.",
            expectedAI: "Dale, necesito el número de préstamo para poder ayudarte."
          },
          {
            human: "Si, el numero de prestamos es 10019.",
            expectedAI:
              "Préstamo #10019, Cliente: Maria Garcia, Pago: RD$ 650 semanal. ¿Confirmas el pago de RD$ 650 para Maria Garcia?",
            tools: [
              {
                name: "getLoanByLoanId",
                expectedArgs: { loanId: "10019" },
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "Informacion del prestamo obtenida.",
                  data: {
                    loan: {
                      id: "loan-uuid-10019",
                      loanId: 10019,
                      principal: 5000,
                      termLength: 8,
                      paymentAmount: 650,
                      paymentFrequency: "WEEKLY",
                      status: "ACTIVE"
                    },
                    member: {
                      id: "member-1",
                      name: "Maria Garcia",
                      phone: "+18091234567"
                    }
                  }
                }
              }
            ]
          },
          {
            human: "Si.",
            expectedAI: "¡Listo!",
            tools: [
              {
                name: "createPayment",
                expectedArgs: {
                  loanId: "10019",
                  amount: "650"
                },
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "OK",
                  data: {
                    paymentId: "payment-uuid-p3",
                    amount: 650,
                    loan: {
                      loanId: 10019,
                      principal: 5000,
                      termLength: 8,
                      paymentAmount: 650,
                      paymentFrequency: "WEEKLY",
                      status: "ACTIVE"
                    },
                    member: {
                      id: "member-1",
                      name: "Maria Garcia",
                      phone: "+18091234567"
                    }
                  }
                }
              },
              {
                name: "sendReceiptViaWhatsApp",
                expectedArgs: { paymentId: "payment-uuid-p3" },
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "OK",
                  data: {
                    messageId: "msg-123"
                  }
                }
              }
            ]
          }
        ]
      },
      {
        id: "happy-path-export-members",
        description: "Happy path for exporting collector members list",
        turns: [
          {
            human: "Hola!",
            expectedAI:
              "¡Hola! Soy Juan, tu asistente de Mikro Créditos. ¿En qué te puedo ayudar hoy?"
          },
          {
            human: "Necesito la lista de los miembros.",
            expectedAI: "¡Listo! Te envié el reporte con 15 préstamos de 12 miembros.",
            tools: [
              {
                name: "exportCollectorMembers",
                expectedArgs: {},
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "Reporte enviado con 15 prestamos de 12 miembros.",
                  data: {
                    messageId: "msg-456",
                    filename: "reporte-miembros-2026-01-27.xlsx",
                    loanCount: 15,
                    memberCount: 12
                  }
                }
              }
            ]
          }
        ]
      },
      {
        id: "get-member-by-phone",
        description: "Show member information by phone number",
        turns: [
          {
            human: "Hola",
            expectedAI:
              "¡Hola! Soy Juan, tu asistente de Mikro Créditos. ¿En qué te puedo ayudar hoy?"
          },
          {
            human: "Necesito ver la información del cliente con teléfono 809-555-1234",
            expectedAI:
              "Cliente: Ana Rodríguez, Teléfono: 809-555-1234, Cédula: 001-9876543-2, Dirección: Calle Los Pinos #45, Santo Domingo. ¿Necesitas algo más?",
            tools: [
              {
                name: "getMemberByPhone",
                expectedArgs: { phone: "809-555-1234" },
                matchMode: "judge",
                mockResponse: {
                  success: true,
                  message: "Member found",
                  data: {
                    id: "member-ana-1",
                    name: "Ana Rodríguez",
                    phone: "+18095551234",
                    idNumber: "001-9876543-2",
                    homeAddress: "Calle Los Pinos #45, Santo Domingo"
                  }
                }
              }
            ]
          },
          {
            human: "No, gracias",
            expectedAI: "Perfecto."
          }
        ]
      },
      {
        id: "list-loans-by-collector",
        description: "Show loans assigned to the collector",
        turns: [
          {
            human: "Hola!",
            expectedAI:
              "¡Hola! Soy Juan, tu asistente de Mikro Créditos. ¿En qué te puedo ayudar hoy?"
          },
          {
            human: "Muestrame los préstamos que tengo asignados",
            expectedAI:
              "Tienes 3 préstamos asignados:\n\n1. Préstamo #10001, Cliente: Maria Garcia, Pago: RD$ 650 semanal\n2. Préstamo #10002, Cliente: Juan Pérez, Pago: RD$ 800 semanal\n3. Préstamo #10003, Cliente: Ana Rodríguez, Pago: RD$ 500 diario\n\n¿Necesitas algo más?",
            tools: [
              {
                name: "listLoansByCollector",
                expectedArgs: {},
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "Loans found",
                  data: {
                    loans: [
                      {
                        id: "loan-uuid-10001",
                        loanId: 10001,
                        principal: 5000,
                        paymentAmount: 650,
                        paymentFrequency: "WEEKLY",
                        status: "ACTIVE",
                        member: {
                          id: "member-1",
                          name: "Maria Garcia",
                          phone: "+18091234567"
                        }
                      },
                      {
                        id: "loan-uuid-10002",
                        loanId: 10002,
                        principal: 8000,
                        paymentAmount: 800,
                        paymentFrequency: "WEEKLY",
                        status: "ACTIVE",
                        member: {
                          id: "member-2",
                          name: "Juan Pérez",
                          phone: "+18091234568"
                        }
                      },
                      {
                        id: "loan-uuid-10003",
                        loanId: 10003,
                        principal: 3000,
                        paymentAmount: 500,
                        paymentFrequency: "DAILY",
                        status: "ACTIVE",
                        member: {
                          id: "member-3",
                          name: "Ana Rodríguez",
                          phone: "+18095551234"
                        }
                      }
                    ]
                  }
                }
              }
            ]
          },
          {
            human: "No, todo bien",
            expectedAI: "Perfecto."
          }
        ]
      },
      {
        id: "payment-by-phone",
        description: "Register payment by searching member with phone number",
        turns: [
          {
            human: "Hola",
            expectedAI:
              "¡Hola! Soy Juan, tu asistente de Mikro Créditos. ¿En qué te puedo ayudar hoy?"
          },
          {
            human: "Voy a cobrar al 809-123-4567",
            expectedAI:
              "Préstamo: #10019\nCliente: Maria Garcia\nPago: RD$ 650 semanal\n¿Confirmas el pago de RD$ 650 para Maria Garcia?",
            tools: [
              {
                name: "listMemberLoansByPhone",
                expectedArgs: { phone: "809-123-4567" },
                matchMode: "judge",
                mockResponse: {
                  success: true,
                  message: "Member and loans found",
                  data: {
                    member: {
                      id: "member-1",
                      name: "Maria Garcia",
                      phone: "+18091234567"
                    },
                    loans: [
                      {
                        id: "loan-uuid-10019",
                        loanId: 10019,
                        principal: 5000,
                        paymentAmount: 650,
                        paymentFrequency: "WEEKLY",
                        status: "ACTIVE"
                      }
                    ]
                  }
                }
              }
            ]
          },
          {
            human: "Si, dale",
            expectedAI: "¡Listo!",
            tools: [
              {
                name: "createPayment",
                expectedArgs: {
                  loanId: "10019",
                  amount: "650"
                },
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "OK",
                  data: {
                    paymentId: "payment-uuid-phone-1",
                    amount: 650,
                    loan: {
                      loanId: 10019,
                      principal: 5000,
                      paymentAmount: 650,
                      paymentFrequency: "WEEKLY",
                      status: "ACTIVE"
                    },
                    member: {
                      id: "member-1",
                      name: "Maria Garcia",
                      phone: "+18091234567"
                    }
                  }
                }
              },
              {
                name: "sendReceiptViaWhatsApp",
                expectedArgs: { paymentId: "payment-uuid-phone-1" },
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "OK",
                  data: {
                    messageId: "msg-789"
                  }
                }
              }
            ]
          }
        ]
      }
    ]
  }
};
