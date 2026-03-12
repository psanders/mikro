/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { Agent } from "@mikro/agents";

export const maria: Agent = {
  name: "maria",
  systemPrompt: `Eres María, la asistente administrativa de Mikro Créditos para administradores. Ayudas a registrar pagos, enviar recibos y generar reportes.

## REGLAS CRÍTICAS

1. SALUDO: Sigue la directiva de sesión al inicio del mensaje. Usa el nombre del usuario que aparece en el contexto para personalizar el saludo.
   - Si dice [NUEVA SESIÓN] y el admin te saluda: "¡Hola [nombre]! Soy María, tu asistente administrativa de Mikro Créditos. ¿En qué te puedo ayudar?"
   - Si dice [SESIÓN ACTIVA] y el admin te saluda: "¡Qué bueno verte de nuevo, [nombre]! ¿En qué te puedo ayudar?"
   - Si dice [SESIÓN ACTIVA] y el admin no saluda: NO te presentes, responde directamente.
   - Si el admin NO saluda (pide algo directamente): NO saludes, responde directamente a su solicitud.
   - Si dice [NUEVA SESIÓN] y el admin saluda Y además pide algo (reporte, recibo, pago, etc.): saluda brevemente y acto seguido cumple la solicitud llamando la herramienta; nunca respondas solo "¡Listo! ¿Algo más?" sin haber ejecutado la herramienta.
2. NUNCA uses asteriscos (*), guiones bajos (_), ni markdown - SOLO texto plano
3. Después de pago exitoso, recibo enviado, reporte o export responde SOLO: "¡Listo! ¿Algo más?" - NADA más. NUNCA repitas ni parafrasees el mensaje de la herramienta; el usuario ya ve el resultado en su pantalla.
4. NUNCA INVENTES DATOS: SIEMPRE llama las herramientas para obtener datos reales. Cada número de préstamo distinto = una llamada a \`getLoanByLoanId\`.
5. SIEMPRE EJECUTA HERRAMIENTAS: Cuando el usuario confirma una acción ("sí", "dale", "confirmo") o solicita un reporte/recibo, DEBES llamar la herramienta correspondiente CADA VEZ. NUNCA respondas "¡Listo!" sin haber llamado la herramienta primero. Esto aplica también en nueva sesión: si piden algo, llama la herramienta en esta misma respuesta. Aunque hayas hecho una acción similar antes en la conversación, cada solicitud requiere su propia ejecución. Los mensajes del usuario pueden incluir notas [SISTEMA: Herramientas ejecutadas en respuesta anterior: ...] — eso describe acciones YA completadas ANTES; la solicitud actual necesita herramientas NUEVAS. NUNCA generes texto con formato [SISTEMA:...] ni [Acciones:...] en tus respuestas.

## Estilo
- Habla informal y directo ("dale", "listo", "perfecto")
- Usa "tú", no "usted"
- Confirma la información antes de crear registros

## Herramientas - LLAMAR INMEDIATAMENTE

- \`getLoanByLoanId\`: Cuando den número de préstamo (cada número = una llamada)
- \`createPayment\` → \`sendReceiptViaWhatsApp\`: Después de confirmación (SECUENCIAL: espera respuesta de createPayment, luego sendReceiptViaWhatsApp con data.paymentId)
- \`listPaymentsByLoanId\`: Cuando pidan recibo de un préstamo ya pagado → obtén lastPayment.id → \`sendReceiptViaWhatsApp\`
- \`listCustomerLoansByPhone\`: Cuando den teléfono para cobrar/registrar pago
- \`calculateLoan\`: Cuando pidan calcular opciones de préstamo (monto, interés, frecuencia, duración)
- \`exportAllCustomers\`: Cuando pidan reporte/lista de todos los clientes. Por defecto envía imagen agrupada por estado de pago. Si piden "Excel", "detallado" o "reporte completo" usa format "detailed".
- \`generatePerformanceReport\`: Cuando pidan reporte de rendimiento del portafolio (métricas y gráficos, una página)
- \`generateDefaultedReport\`: Cuando pidan reporte de mora/defaulted (todos los préstamos en mora con resumen de notas)
- \`generateRenewalCandidatesReport\`: Cuando pidan reporte de candidatos a renovación, préstamos por terminar, quiénes son buenos para otro préstamo
- \`generateCollectionsAuditReport\`: Cuando pidan reporte de auditoría de cobranza, quién fue notificado hoy (o una fecha), qué mensajes se enviaron y si hubo errores
- \`runSingleCollection\`: Cuando pidan enviar recordatorio, aviso de mora o llamada de cobro a un préstamo específico (por número de préstamo)

## Flujo cobro individual
Piden enviar recordatorio, aviso de mora o llamada de cobro a un préstamo → Opcional: \`getLoanByLoanId\` para confirmar que existe → \`runSingleCollection\` con loanId. Si especifican canal (WhatsApp/llamada) o tipo (recordatorio/aviso/llamada), pásalos. Responde con el mensaje de la herramienta. Indica siempre el canal (por WhatsApp o por llamada) porque el mensaje va al cliente, no al admin (ej: "Listo. Envié recordatorio de pago por WhatsApp a [nombre] (préstamo #X)." o "Listo. Envié aviso de mora por llamada a [nombre] (préstamo #X).").

## Flujo registrar pago
1. Admin pide registrar pago → Responde: "Dame el número de préstamo o el teléfono del cliente para buscar el préstamo."
2. Dan número de préstamo → \`getLoanByLoanId\`. Dan teléfono → \`listCustomerLoansByPhone\`.
3. Con la respuesta, muestra: "Préstamo #[loanId], Cliente: [nombre], Pago: RD$ [paymentAmount] [frecuencia]. ¿Confirmas el pago de RD$ [paymentAmount] para [nombre]?"
4. Admin confirma ("sí", "dale", "confirmo", etc.) → Llama \`createPayment\` con loanId y amount=paymentAmount del préstamo → luego \`sendReceiptViaWhatsApp\` con data.paymentId → responde SOLO "¡Listo! ¿Algo más?"

IMPORTANTE: El monto del pago SIEMPRE es el paymentAmount del préstamo. NUNCA preguntes el monto al usuario. Cuando el usuario confirma, registra el pago inmediatamente con el paymentAmount.

## Flujo recibo (pago ya registrado)
Piden recibo del préstamo #X → \`listPaymentsByLoanId\` → lastPayment.id → \`sendReceiptViaWhatsApp\` → responde SOLO "¡Listo! ¿Algo más?" - NO expliques qué enviaste, el usuario ya lo ve. Si no hay pagos: "No hay pagos registrados para el préstamo #X."

## Flujo calculadora de préstamo
Si piden calcular un préstamo, comparar opciones de duración, o preguntar cuánto sería el pago según plazo:
1. Pide/confirmar estos datos: principal, tasa total de interés, frecuencia (daily/weekly), duración base.
2. Convierte porcentaje a decimal para la herramienta (ej: 30% -> 0.30).
3. Llama \`calculateLoan\`.
4. Responde con las opciones en texto claro, destacando la opción base y las opciones de menor/mayor duración.

## Flujo export
Piden reporte/lista de clientes → \`exportAllCustomers\` (sin argumentos = imagen simplificada). Si piden "en Excel", "detallado" o "reporte completo" → \`exportAllCustomers\` con format "detailed". Responde SOLO "¡Listo! ¿Algo más?" - NO menciones cantidad de clientes, préstamos ni detalles del reporte. El usuario ya ve el archivo.

## Flujo reporte de rendimiento
Piden reporte de rendimiento, reporte del portafolio o metricas del negocio → \`generatePerformanceReport\` (opcional: startDate, endDate en YYYY-MM-DD) → responde SOLO "¡Listo! ¿Algo más?" - NO describas el contenido del reporte. El usuario ya lo ve.

## Flujo reporte de mora
Piden reporte de mora, reporte de defaulted, o préstamos en mora → \`generateDefaultedReport\` (sin argumentos) → responde SOLO "¡Listo! ¿Algo más?" - NO describas el contenido del reporte. El usuario ya lo ve.

## Flujo reporte de renovación
Piden reporte de candidatos a renovación, préstamos por terminar, quiénes pueden renovar o quiénes son buenos para otro préstamo → \`generateRenewalCandidatesReport\` (sin argumentos) → responde SOLO "¡Listo! ¿Algo más?" - NO describas el contenido del reporte. El usuario ya lo ve.

## Flujo reporte de auditoría de cobranza
Piden reporte de auditoría de cobranza, quién fue notificado hoy, notificaciones del día o si los mensajes se están enviando → \`generateCollectionsAuditReport\` (sin argumentos = hoy; opcional: date en YYYY-MM-DD para otra fecha) → responde SOLO "¡Listo! ¿Algo más?" - NO describas el contenido. El usuario ya lo ve.

## Clarificación de reportes
Si piden solo "un reporte" o "el reporte" sin especificar: pregunta "¿Qué reporte? Puedo enviarte: reporte de clientes (imagen o Excel), reporte de rendimiento del portafolio, reporte de mora, reporte de candidatos a renovación, o reporte de auditoría de cobranza." Si dicen clientes/lista → \`exportAllCustomers\`. Si piden Excel o detallado → \`exportAllCustomers\` con format "detailed". Si dicen rendimiento/portafolio/métricas → \`generatePerformanceReport\`. Si dicen mora/defaulted → \`generateDefaultedReport\`. Si dicen renovación/candidatos a renovar/préstamos por terminar → \`generateRenewalCandidatesReport\`. Si dicen auditoría de cobranza/quién fue notificado/notificaciones del día → \`generateCollectionsAuditReport\` (opcional: date en YYYY-MM-DD).

## Guardrails
- Fuera de tema: "Eso no lo puedo hacer yo. Para eso necesitas usar la aplicación o contactar soporte."`,
  allowedTools: [
    "createPayment",
    "sendReceiptViaWhatsApp",
    "listPaymentsByLoanId",
    "getLoanByLoanId",
    "listCustomerLoansByPhone",
    "calculateLoan",
    "exportAllCustomers",
    "generatePerformanceReport",
    "generateDefaultedReport",
    "generateRenewalCandidatesReport",
    "generateCollectionsAuditReport",
    "updateLoanStatus",
    "runSingleCollection"
  ],
  temperature: 0.4,
  evaluations: {
    context: {
      userId: "admin-1",
      phone: "+18099999999",
      role: "ADMIN",
      name: "Laura Méndez"
    },
    scenarios: [
      {
        id: "happy-path-register-payment",
        description: "Happy path for registering a payment with loan number",
        turns: [
          {
            human: "Hola!",
            expectedAI:
              "¡Hola Laura! Soy María, tu asistente administrativa de Mikro Créditos. ¿En qué te puedo ayudar?"
          },
          {
            human: "Quisiera registrar un pago.",
            expectedAI:
              "Dame el número de préstamo o el teléfono del cliente para buscar el préstamo."
          },
          {
            human: "El numero de prestamo es 10019.",
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
                    customer: {
                      id: "customer-1",
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
            expectedAI: "¡Listo! ¿Algo más?",
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
                    customer: {
                      id: "customer-1",
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
        id: "happy-path-export-customers",
        description: "Happy path for exporting all customers report",
        turns: [
          {
            human: "Hola!",
            expectedAI:
              "¡Hola Laura! Soy María, tu asistente administrativa de Mikro Créditos. ¿En qué te puedo ayudar?"
          },
          {
            human: "Necesito el reporte de todos los clientes.",
            expectedAI: "¡Listo! ¿Algo más?",
            tools: [
              {
                name: "exportAllCustomers",
                expectedArgs: {},
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "Reporte enviado con 15 prestamos de 12 clientes.",
                  data: {
                    messageId: "msg-456",
                    filename: "reporte-todos-clientes-2026-01-30.xlsx",
                    loanCount: 15,
                    customerCount: 12
                  }
                }
              }
            ]
          }
        ]
      },
      {
        id: "send-receipt-existing-payment",
        description: "Send receipt for an existing payment without registering a new one",
        turns: [
          {
            human: "Hola",
            expectedAI:
              "¡Hola Laura! Soy María, tu asistente administrativa de Mikro Créditos. ¿En qué te puedo ayudar?"
          },
          {
            human: "Necesito el recibo del préstamo 10001",
            expectedAI: "¡Listo! ¿Algo más?",
            tools: [
              {
                name: "listPaymentsByLoanId",
                expectedArgs: { loanId: "10001" },
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message:
                    "Se encontró 1 pago para el préstamo #10001. Último pago: RD$ 650 el 27/1/2026. ID del pago: payment-uuid-001",
                  data: {
                    payments: [
                      {
                        id: "payment-uuid-001",
                        amount: 650,
                        paidAt: "2026-01-27T10:00:00.000Z",
                        status: "COMPLETED",
                        method: "CASH",
                        isLastPayment: true,
                        displayText:
                          "ÚLTIMO PAGO - Monto: RD$ 650, Fecha: 27/1/2026, Estado: COMPLETED"
                      }
                    ],
                    lastPayment: {
                      id: "payment-uuid-001",
                      amount: 650,
                      paidAt: "2026-01-27T10:00:00.000Z",
                      status: "COMPLETED",
                      method: "CASH"
                    },
                    count: 1
                  }
                }
              },
              {
                name: "sendReceiptViaWhatsApp",
                expectedArgs: { paymentId: "payment-uuid-001" },
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "OK",
                  data: {
                    messageId: "msg-receipt-001"
                  }
                }
              }
            ]
          }
        ]
      },
      {
        id: "update-loan-status-completed",
        description: "Admin asks to set a loan status to COMPLETED",
        turns: [
          {
            human: "Cambia el préstamo 10019 a completado.",
            expectedAI: "¡Listo! Estado del préstamo actualizado.",
            tools: [
              {
                name: "updateLoanStatus",
                expectedArgs: { loanId: "10019", status: "COMPLETED" },
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "Estado del préstamo #10019 actualizado a COMPLETED.",
                  data: {
                    id: "loan-uuid-10019",
                    loanId: 10019,
                    status: "COMPLETED"
                  }
                }
              }
            ]
          }
        ]
      },
      {
        id: "off-topic-question",
        description: "Handle off-topic questions",
        turns: [
          {
            human: "Hola",
            expectedAI:
              "¡Hola Laura! Soy María, tu asistente administrativa de Mikro Créditos. ¿En qué te puedo ayudar?"
          },
          {
            human: "Oye, cuánto está el dólar hoy?",
            expectedAI:
              "Eso no lo puedo hacer yo. Para eso necesitas usar la aplicación o contactar soporte."
          }
        ]
      },
      {
        id: "report-clarification",
        description:
          "When user asks for 'a report' without specifying which, Maria asks for clarification and does not call any tool",
        turns: [
          {
            human: "Hola",
            expectedAI:
              "¡Hola Laura! Soy María, tu asistente administrativa de Mikro Créditos. ¿En qué te puedo ayudar?"
          },
          {
            human: "Necesito un reporte.",
            expectedAI:
              "¿Qué reporte necesitas? Puedo enviarte el reporte de miembros (imagen por estado de pago), el reporte de miembros en Excel (detallado), el reporte de rendimiento del portafolio (métricas y gráficos) o el reporte de mora.",
            tools: []
          }
        ]
      },
      {
        id: "export-customers-detailed-excel",
        description:
          "When user asks for customers report in Excel, Maria calls exportAllCustomers with format detailed",
        turns: [
          {
            human: "Necesito el reporte de miembros en Excel.",
            expectedAI: "¡Listo! ¿Algo más?",
            tools: [
              {
                name: "exportAllCustomers",
                expectedArgs: { format: "detailed" },
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "Reporte enviado con 15 prestamos de 12 miembros.",
                  data: {
                    messageId: "msg-excel",
                    filename: "reporte-todos-miembros-2026-01-30.xlsx",
                    loanCount: 15,
                    customerCount: 12
                  }
                }
              }
            ]
          }
        ]
      },
      {
        id: "single-collection-reminder",
        description: "Admin asks to send a payment reminder for a specific loan",
        turns: [
          {
            human: "Envía un recordatorio de pago al préstamo 10019.",
            expectedAI:
              "Listo. Envié recordatorio de pago por WhatsApp a Maria Garcia (préstamo #10019).",
            tools: [
              {
                name: "runSingleCollection",
                expectedArgs: { loanId: "10019" },
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message:
                    "Listo. Envié recordatorio de pago por WhatsApp a Maria Garcia (préstamo #10019).",
                  data: {
                    loanId: 10019,
                    type: "PAYMENT_REMINDER",
                    channel: "WHATSAPP",
                    customerName: "Maria Garcia",
                    dryRun: false
                  }
                }
              }
            ]
          }
        ]
      },
      {
        id: "single-collection-with-overrides",
        description: "Admin asks to send an overdue notice via WhatsApp for a specific loan",
        turns: [
          {
            human: "Manda aviso de mora por WhatsApp al préstamo 10001.",
            expectedAI: "Listo. Envié aviso de mora por WhatsApp a Juan Perez (préstamo #10001).",
            tools: [
              {
                name: "runSingleCollection",
                expectedArgs: { loanId: "10001", type: "OVERDUE_NOTICE", channel: "WHATSAPP" },
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message:
                    "Listo. Envié aviso de mora por WhatsApp a Juan Perez (préstamo #10001).",
                  data: {
                    loanId: 10001,
                    type: "OVERDUE_NOTICE",
                    channel: "WHATSAPP",
                    customerName: "Juan Perez",
                    dryRun: false
                  }
                }
              }
            ]
          }
        ]
      },
      {
        id: "re-request-same-report",
        description:
          "After generating customer report, then performance report, user re-requests customer report - must call exportAllCustomers again",
        turns: [
          {
            human: "Hola!",
            expectedAI:
              "¡Hola Laura! Soy María, tu asistente administrativa de Mikro Créditos. ¿En qué te puedo ayudar?"
          },
          {
            human: "Necesito el reporte de clientes.",
            expectedAI: "¡Listo! ¿Algo más?",
            tools: [
              {
                name: "exportAllCustomers",
                expectedArgs: {},
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "Reporte enviado con 15 prestamos de 12 clientes.",
                  data: {
                    messageId: "msg-rpt-1",
                    filename: "reporte-todos-clientes-2026-02-19.xlsx",
                    loanCount: 15,
                    customerCount: 12
                  }
                }
              }
            ]
          },
          {
            human: "Ahora envíame el reporte de rendimiento.",
            expectedAI: "¡Listo! ¿Algo más?",
            tools: [
              {
                name: "generatePerformanceReport",
                expectedArgs: {},
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "Reporte de rendimiento generado.",
                  data: { messageId: "msg-rpt-2" }
                }
              }
            ]
          },
          {
            human: "Envíame otra vez el reporte de clientes.",
            expectedAI: "¡Listo! ¿Algo más?",
            tools: [
              {
                name: "exportAllCustomers",
                expectedArgs: {},
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "Reporte enviado con 16 prestamos de 13 clientes.",
                  data: {
                    messageId: "msg-rpt-3",
                    filename: "reporte-todos-clientes-2026-02-19-v2.xlsx",
                    loanCount: 16,
                    customerCount: 13
                  }
                }
              }
            ]
          }
        ]
      },
      {
        id: "discussion-vs-execution",
        description:
          "User asks what reports are available (discussion only), then requests one - must call tool despite earlier mention",
        turns: [
          {
            human: "¿Qué reportes puedes generar?",
            expectedAI:
              "Puedo generar estos reportes: 1) Reporte de clientes (imagen agrupada por estado de pago o Excel detallado). 2) Reporte de rendimiento del portafolio (métricas y gráficos). 3) Reporte de mora (préstamos en DEFAULTED con resumen de notas). 4) Reporte de candidatos a renovación (préstamos por terminar o completados con calificación). 5) Reporte de auditoría de cobranza (quién fue notificado y si hubo errores). ¿Cuál te gustaría ver?",
            tools: []
          },
          {
            human: "Envíame el de rendimiento.",
            expectedAI: "¡Listo! ¿Algo más?",
            tools: [
              {
                name: "generatePerformanceReport",
                expectedArgs: {},
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "Reporte de rendimiento generado.",
                  data: { messageId: "msg-perf-1" }
                }
              }
            ]
          }
        ]
      },
      {
        id: "report-after-discussion-then-re-request",
        description:
          "User discusses available reports, requests defaulted report, then re-requests it - must call tool both times",
        turns: [
          {
            human: "Hola!",
            expectedAI:
              "¡Hola Laura! Soy María, tu asistente administrativa de Mikro Créditos. ¿En qué te puedo ayudar?"
          },
          {
            human: "¿Cuántos reportes tienes disponibles?",
            expectedAI:
              "Tengo 5 reportes disponibles: reporte de clientes (imagen agrupada por estado de pago o Excel detallado), reporte de rendimiento del portafolio (métricas y gráficos), reporte de mora (préstamos en DEFAULTED con resumen de notas), reporte de candidatos a renovación (préstamos por terminar o completados con calificación), y reporte de auditoría de cobranza (quién fue notificado y si hubo errores). ¿Cuál te gustaría ver?",
            tools: []
          },
          {
            human: "Perfecto. Envíame el de mora.",
            expectedAI: "¡Listo! ¿Algo más?",
            tools: [
              {
                name: "generateDefaultedReport",
                expectedArgs: {},
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "Reporte de mora generado.",
                  data: { messageId: "msg-mora-1" }
                }
              }
            ]
          },
          {
            human: "Envíame el de mora otra vez.",
            expectedAI: "¡Listo! ¿Algo más?",
            tools: [
              {
                name: "generateDefaultedReport",
                expectedArgs: {},
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "Reporte de mora generado.",
                  data: { messageId: "msg-mora-2" }
                }
              }
            ]
          }
        ]
      },
      {
        id: "renewal-candidates-report",
        description:
          "User requests renewal candidates report; Maria calls generateRenewalCandidatesReport.",
        turns: [
          {
            human: "Quiero el reporte de candidatos a renovación.",
            expectedAI: "¡Listo! ¿Algo más?",
            tools: [
              {
                name: "generateRenewalCandidatesReport",
                expectedArgs: {},
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "Reporte de candidatos a renovación enviado.",
                  data: { messageId: "msg-renewal-1" }
                }
              }
            ]
          }
        ]
      },
      {
        id: "false-completion-report-after-prior-listo",
        description:
          "Prior payment action produces 'Listo!', then user requests customer report - must call exportAllCustomers, not echo prior Listo pattern. Mirrors real production bug.",
        turns: [
          {
            human: "Registrar pago del préstamo 10019.",
            expectedAI:
              "Préstamo #10019, Cliente: Maria Garcia, Pago: RD$ 650 semanal. ¿Confirmas el pago de RD$ 650 para Maria Garcia?",
            tools: [
              {
                name: "getLoanByLoanId",
                expectedArgs: { loanId: "10019" },
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "Información del préstamo obtenida.",
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
                    customer: {
                      id: "customer-1",
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
            expectedAI: "¡Listo! ¿Algo más?",
            tools: [
              {
                name: "createPayment",
                expectedArgs: { loanId: "10019", amount: "650" },
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "OK",
                  data: {
                    paymentId: "payment-uuid-p3",
                    amount: 650,
                    loan: {
                      loanId: 10019,
                      paymentAmount: 650,
                      paymentFrequency: "WEEKLY",
                      status: "ACTIVE"
                    },
                    customer: { id: "customer-1", name: "Maria Garcia", phone: "+18091234567" }
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
                  data: { messageId: "msg-receipt-p3" }
                }
              }
            ]
          },
          {
            human: "Dame el reporte de clientes.",
            expectedAI: "¡Listo! ¿Algo más?",
            tools: [
              {
                name: "exportAllCustomers",
                expectedArgs: {},
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "Reporte enviado con 15 prestamos de 12 clientes.",
                  data: {
                    messageId: "msg-rpt-fc1",
                    filename: "reporte-todos-clientes-2026-02-19.xlsx",
                    loanCount: 15,
                    customerCount: 12
                  }
                }
              }
            ]
          },
          {
            human: "Dale otra vez. No lo veo.",
            expectedAI: "¡Listo! ¿Algo más?",
            tools: [
              {
                name: "exportAllCustomers",
                expectedArgs: {},
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "Reporte enviado con 15 prestamos de 12 clientes.",
                  data: {
                    messageId: "msg-rpt-fc2",
                    filename: "reporte-todos-clientes-2026-02-19-v2.xlsx",
                    loanCount: 15,
                    customerCount: 12
                  }
                }
              }
            ]
          }
        ]
      },
      {
        id: "long-session-many-listos-then-report",
        description:
          "Production-realistic long session: 3 payments + 1 report + 1 receipt, building up many Listo! responses in history, then re-request report at the end. Critical turns 9-10 must call tools.",
        turns: [
          {
            human: "Hola!",
            expectedAI:
              "¡Hola Laura! Soy María, tu asistente administrativa de Mikro Créditos. ¿En qué te puedo ayudar?"
          },
          {
            human: "Registrar pago del préstamo 10019.",
            expectedAI:
              "Préstamo #10019, Cliente: Maria Garcia, Pago: RD$ 650 semanal. ¿Confirmas el pago de RD$ 650 para Maria Garcia?",
            tools: [
              {
                name: "getLoanByLoanId",
                expectedArgs: { loanId: "10019" },
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "Información del préstamo obtenida.",
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
                    customer: { id: "customer-1", name: "Maria Garcia", phone: "+18091234567" }
                  }
                }
              }
            ]
          },
          {
            human: "Si.",
            expectedAI: "¡Listo! ¿Algo más?",
            tools: [
              {
                name: "createPayment",
                expectedArgs: { loanId: "10019", amount: "650" },
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "OK",
                  data: {
                    paymentId: "pay-1",
                    amount: 650,
                    loan: {
                      loanId: 10019,
                      paymentAmount: 650,
                      paymentFrequency: "WEEKLY",
                      status: "ACTIVE"
                    },
                    customer: { id: "customer-1", name: "Maria Garcia", phone: "+18091234567" }
                  }
                }
              },
              {
                name: "sendReceiptViaWhatsApp",
                expectedArgs: { paymentId: "pay-1" },
                matchMode: "strict",
                mockResponse: { success: true, message: "OK", data: { messageId: "msg-1" } }
              }
            ]
          },
          {
            human: "Ahora el préstamo 10020.",
            expectedAI:
              "Préstamo #10020, Cliente: Roberto Sanchez, Pago: RD$ 500 diario. ¿Confirmas el pago de RD$ 500 para Roberto Sanchez?",
            tools: [
              {
                name: "getLoanByLoanId",
                expectedArgs: { loanId: "10020" },
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "Información del préstamo obtenida.",
                  data: {
                    loan: {
                      id: "loan-uuid-10020",
                      loanId: 10020,
                      principal: 3000,
                      termLength: 30,
                      paymentAmount: 500,
                      paymentFrequency: "DAILY",
                      status: "ACTIVE"
                    },
                    customer: { id: "customer-2", name: "Roberto Sanchez", phone: "+18091112222" }
                  }
                }
              }
            ]
          },
          {
            human: "Si.",
            expectedAI: "¡Listo! ¿Algo más?",
            tools: [
              {
                name: "createPayment",
                expectedArgs: { loanId: "10020", amount: "500" },
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "OK",
                  data: {
                    paymentId: "pay-2",
                    amount: 500,
                    loan: {
                      loanId: 10020,
                      paymentAmount: 500,
                      paymentFrequency: "DAILY",
                      status: "ACTIVE"
                    },
                    customer: { id: "customer-2", name: "Roberto Sanchez", phone: "+18091112222" }
                  }
                }
              },
              {
                name: "sendReceiptViaWhatsApp",
                expectedArgs: { paymentId: "pay-2" },
                matchMode: "strict",
                mockResponse: { success: true, message: "OK", data: { messageId: "msg-2" } }
              }
            ]
          },
          {
            human: "Ahora el 10030.",
            expectedAI:
              "Préstamo #10030, Cliente: Carmen Lopez, Pago: RD$ 1200 quincenal. ¿Confirmas el pago de RD$ 1200 para Carmen Lopez?",
            tools: [
              {
                name: "getLoanByLoanId",
                expectedArgs: { loanId: "10030" },
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "Información del préstamo obtenida.",
                  data: {
                    loan: {
                      id: "loan-uuid-10030",
                      loanId: 10030,
                      principal: 12000,
                      termLength: 12,
                      paymentAmount: 1200,
                      paymentFrequency: "BIWEEKLY",
                      status: "ACTIVE"
                    },
                    customer: { id: "customer-3", name: "Carmen Lopez", phone: "+18093334444" }
                  }
                }
              }
            ]
          },
          {
            human: "Si.",
            expectedAI: "¡Listo! ¿Algo más?",
            tools: [
              {
                name: "createPayment",
                expectedArgs: { loanId: "10030", amount: "1200" },
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "OK",
                  data: {
                    paymentId: "pay-3",
                    amount: 1200,
                    loan: {
                      loanId: 10030,
                      paymentAmount: 1200,
                      paymentFrequency: "BIWEEKLY",
                      status: "ACTIVE"
                    },
                    customer: { id: "customer-3", name: "Carmen Lopez", phone: "+18093334444" }
                  }
                }
              },
              {
                name: "sendReceiptViaWhatsApp",
                expectedArgs: { paymentId: "pay-3" },
                matchMode: "strict",
                mockResponse: { success: true, message: "OK", data: { messageId: "msg-3" } }
              }
            ]
          },
          {
            human: "Dame el reporte de clientes.",
            expectedAI: "¡Listo! ¿Algo más?",
            tools: [
              {
                name: "exportAllCustomers",
                expectedArgs: {},
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "Reporte enviado con 15 prestamos de 12 clientes.",
                  data: {
                    messageId: "msg-rpt-1",
                    filename: "reporte-2026-02-19.xlsx",
                    loanCount: 15,
                    customerCount: 12
                  }
                }
              }
            ]
          },
          {
            human: "Envíame el recibo del préstamo 10019.",
            expectedAI: "¡Listo! ¿Algo más?",
            tools: [
              {
                name: "listPaymentsByLoanId",
                expectedArgs: { loanId: "10019" },
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "Se encontró 1 pago para el préstamo #10019.",
                  data: {
                    payments: [
                      {
                        id: "pay-1",
                        amount: 650,
                        paidAt: "2026-02-19T10:00:00Z",
                        status: "COMPLETED",
                        method: "CASH",
                        isLastPayment: true,
                        displayText:
                          "ÚLTIMO PAGO - Monto: RD$ 650, Fecha: 19/2/2026, Estado: COMPLETED"
                      }
                    ],
                    lastPayment: {
                      id: "pay-1",
                      amount: 650,
                      paidAt: "2026-02-19T10:00:00Z",
                      status: "COMPLETED",
                      method: "CASH"
                    },
                    count: 1
                  }
                }
              },
              {
                name: "sendReceiptViaWhatsApp",
                expectedArgs: { paymentId: "pay-1" },
                matchMode: "strict",
                mockResponse: { success: true, message: "OK", data: { messageId: "msg-rcpt-1" } }
              }
            ]
          },
          {
            human: "Dame el reporte de clientes otra vez.",
            expectedAI: "¡Listo! ¿Algo más?",
            tools: [
              {
                name: "exportAllCustomers",
                expectedArgs: {},
                matchMode: "strict",
                mockResponse: {
                  success: true,
                  message: "Reporte enviado con 16 prestamos de 13 clientes.",
                  data: {
                    messageId: "msg-rpt-2",
                    filename: "reporte-2026-02-19-v2.xlsx",
                    loanCount: 16,
                    customerCount: 13
                  }
                }
              }
            ]
          }
        ]
      },
      {
        id: "calculate-loan-options",
        description:
          "Admin asks for loan calculation options and Maria calls calculateLoan with normalized inputs",
        turns: [
          {
            human: "Calcula un préstamo de 5000 a 30% semanal con duración base de 10.",
            expectedAI:
              "Perfecto. Aquí tienes opciones de préstamo para RD$ 5000 con 30% semanal y base en 10 periodos.",
            tools: [
              {
                name: "calculateLoan",
                expectedArgs: {
                  principal: "5000",
                  interestRate: "0.30",
                  paymentFrequency: "WEEKLY",
                  baseDuration: "10"
                },
                matchMode: "judge",
                mockResponse: {
                  success: true,
                  message:
                    "Opciones calculadas para RD$ 5000.00:\n10 weekly (base): RD$ 650 por periodo, interés 30.00%, total RD$ 6500.00\n8 weekly: RD$ 800 por periodo, interés 27.00%, total RD$ 6350.00",
                  data: {
                    principal: 5000,
                    paymentFrequency: "WEEKLY",
                    baseDuration: 10,
                    options: [
                      {
                        duration: 10,
                        paymentFrequency: "WEEKLY",
                        interestRate: 0.3,
                        totalInterest: 1500,
                        totalRepay: 6500,
                        paymentPerPeriod: 650,
                        isBase: true
                      },
                      {
                        duration: 8,
                        paymentFrequency: "WEEKLY",
                        interestRate: 0.27,
                        totalInterest: 1350,
                        totalRepay: 6350,
                        paymentPerPeriod: 800,
                        isBase: false
                      }
                    ]
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
