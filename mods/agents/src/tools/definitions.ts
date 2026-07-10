/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Tool definitions for OpenAI function calling.
 * These define what tools the LLM can call and their parameters.
 */
import type { ToolFunction } from "../llm/types.js";

/**
 * Tool definition for creating a new customer.
 * Not exposed to any WhatsApp agent persona (agents.yaml) today — reachable
 * only via the founder-copilot chat, which lists it as a WRITE_TOOL (see
 * `mods/apiserver/src/api/copilot/toolPolicy.ts`).
 */
export const createCustomerTool: ToolFunction = {
  type: "function",
  function: {
    name: "createCustomer",
    description:
      "Crear una nueva cuenta de cliente después de recopilar toda la información requerida. El nombre y número de cédula DEBEN ser extraídos de las fotos de la cédula.",
    parameters: {
      type: "object",
      properties: {
        phone: {
          type: "string",
          description:
            "Número de teléfono del cliente (se proporciona automáticamente del contexto)"
        },
        name: {
          type: "string",
          description: "Nombre completo del cliente extraído de la cédula de identidad"
        },
        idNumber: {
          type: "string",
          description: "Número de cédula en formato 000-0000000-0"
        },
        collectionPoint: {
          type: "string",
          description:
            "URL del punto de cobro (opcional, debe ser una URL válida, por ejemplo: https://maps.google.com/?q=Dirección)"
        },
        homeAddress: {
          type: "string",
          description: "Dirección del hogar del cliente"
        },
        jobPosition: {
          type: "string",
          description: "Empleo actual del cliente"
        },
        income: {
          type: "string",
          description: "Ingresos aproximados del cliente"
        },
        isBusinessOwner: {
          type: "string",
          description: "Indica si el cliente es propietario de un negocio (true/false)"
        },
        preferredPaymentDay: {
          type: "string",
          description:
            "Dia preferido de pago semanal. Opciones: MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY. Por defecto: MONDAY.",
          enum: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"]
        },
        assignedCollectorId: {
          type: "string",
          description:
            "ID (uuid) del cobrador asignado. Obligatorio: resolver con listUsers (role=COLLECTOR) antes de llamar esta herramienta; todo cliente debe tener un cobrador asignado (mikro/#41)."
        }
      },
      required: ["name", "idNumber", "homeAddress", "assignedCollectorId"]
    }
  }
};

/**
 * Tool definition for creating a payment (complete workflow).
 * Used by Juan (collector). This tool handles the complete payment registration:
 * gets loan by loan ID (numeric), retrieves customer information, validates collector assignment,
 * creates payment, and generates receipt.
 */
export const createPaymentTool: ToolFunction = {
  type: "function",
  function: {
    name: "createPayment",
    description:
      "Registrar un nuevo pago para un préstamo usando el número de préstamo (loan ID numérico, ej: 10000, 10001). Esta herramienta obtiene el préstamo, recupera la información del cliente, valida que el cobrador esté asignado, crea el pago y genera el recibo automáticamente.",
    parameters: {
      type: "object",
      properties: {
        loanId: {
          type: "string",
          description:
            "ID numérico del préstamo (ej: 10000, 10001). Este es el número de préstamo, no el UUID."
        },
        amount: {
          type: "string",
          description: "Monto del pago en pesos dominicanos"
        },
        notes: {
          type: "string",
          description: "Notas adicionales sobre el pago (opcional)"
        }
      },
      required: ["loanId", "amount"]
    }
  }
};

/**
 * Tool definition for sending a receipt via WhatsApp.
 * Used by Juan (collector) and the founder copilot (mikro/#118).
 *
 * This is the tool for sending receipts to the collector (requestor), or, when
 * called with an explicit `phone`, to whatever recipient the caller names (the
 * founder copilot always supplies the customer's phone since it has no live
 * WhatsApp conversation of its own to infer a recipient from).
 * It generates the receipt, saves it to disk, and sends it via WhatsApp automatically.
 */
export const sendReceiptViaWhatsAppTool: ToolFunction = {
  type: "function",
  function: {
    name: "sendReceiptViaWhatsApp",
    description:
      "Generar y enviar un recibo por WhatsApp. Genera el recibo, lo guarda en el servidor y lo envía automáticamente por WhatsApp. IMPORTANTE: Esta herramienta REQUIERE el paymentId de la respuesta de createPayment (o de listPaymentsByLoanId para un pago ya registrado). DEBES obtener el paymentId antes de llamar esta herramienta. Si no se indica `phone`, se envía al cobrador que solicita el recibo en la conversación actual; el copiloto del fundador SIEMPRE debe indicar `phone` explícitamente (el teléfono del cliente dueño del préstamo).",
    parameters: {
      type: "object",
      properties: {
        paymentId: {
          type: "string",
          description:
            "ID del pago (UUID) para el cual enviar el recibo. Debe ser un UUID válido en formato xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx. Este es el ID del pago, NO el número de préstamo. Puedes obtener el paymentId del resultado de createPayment."
        },
        phone: {
          type: "string",
          description:
            "Teléfono del destinatario del recibo (con o sin código de país). Opcional en la conversación de un cobrador (se usa su propio teléfono); REQUERIDO cuando esta herramienta la invoca el copiloto del fundador."
        }
      },
      required: ["paymentId"]
    }
  }
};

/**
 * Tool definition for listing loans by collector.
 * Used by Juan (collector).
 */
export const listLoansByCollectorTool: ToolFunction = {
  type: "function",
  function: {
    name: "listLoansByCollector",
    description: "Listar todos los préstamos activos asignados al cobrador actual.",
    parameters: {
      type: "object",
      properties: {
        showAll: {
          type: "string",
          description:
            "Si es 'true', muestra todos los préstamos incluyendo los completados. Por defecto solo muestra activos."
        }
      },
      required: []
    }
  }
};

/**
 * Tool definition for getting customer information.
 * Used by Juan (collector).
 */
export const getCustomerTool: ToolFunction = {
  type: "function",
  function: {
    name: "getCustomer",
    description: "Obtener información detallada de un cliente específico.",
    parameters: {
      type: "object",
      properties: {
        customerId: {
          type: "string",
          description: "ID del cliente a buscar"
        }
      },
      required: ["customerId"]
    }
  }
};

/**
 * Tool definition for creating a loan.
 * Used by the founder copilot (Maria, the WhatsApp admin agent, was retired
 * in favor of the copilot — mikro/#120).
 */
export const createLoanTool: ToolFunction = {
  type: "function",
  function: {
    name: "createLoan",
    description: "Crear un nuevo préstamo para un cliente existente.",
    parameters: {
      type: "object",
      properties: {
        customerId: {
          type: "string",
          description: "ID del cliente que recibe el préstamo"
        },
        principal: {
          type: "string",
          description: "Monto del préstamo en pesos dominicanos (ej: 5000, 10000)"
        },
        termLength: {
          type: "string",
          description: "Número de cuotas/pagos (ej: 10)"
        },
        paymentAmount: {
          type: "string",
          description: "Monto de cada pago (ej: 650)"
        },
        paymentFrequency: {
          type: "string",
          description: "Frecuencia de pago: DAILY, WEEKLY, BIWEEKLY o MONTHLY",
          enum: ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]
        },
        startingDate: {
          type: "string",
          description:
            "Fecha de inicio de los ciclos de pago (YYYY-MM-DD). Opcional. Si no se proporciona, se usa la fecha de creación del préstamo."
        }
      },
      required: ["customerId", "principal", "termLength", "paymentAmount", "paymentFrequency"]
    }
  }
};

/**
 * Tool definition for calculating loan payment options.
 * Used by the founder copilot (Maria, the WhatsApp admin agent, was retired
 * in favor of the copilot — mikro/#120).
 */
export const calculateLoanTool: ToolFunction = {
  type: "function",
  function: {
    name: "calculateLoan",
    description:
      "Calcular opciones de préstamo con diferentes duraciones usando una tasa base y ajuste por periodo. Recibe monto, tasa de interés total, frecuencia (DAILY, WEEKLY, BIWEEKLY o MONTHLY) y duración base.",
    parameters: {
      type: "object",
      properties: {
        principal: {
          type: "string",
          description: "Monto del préstamo en pesos dominicanos (ej: 5000, 10000)"
        },
        interestRate: {
          type: "string",
          description:
            "Tasa total de interés como decimal (ej: 0.30 para 30%). Si el usuario dice 30%, convierte a 0.30."
        },
        paymentFrequency: {
          type: "string",
          description: "Frecuencia de pago: DAILY, WEEKLY, BIWEEKLY o MONTHLY",
          enum: ["DAILY", "WEEKLY", "BIWEEKLY", "MONTHLY"]
        },
        baseDuration: {
          type: "string",
          description: "Duración base en número de periodos de pago (ej: 10)"
        },
        adjustmentPerPeriod: {
          type: "string",
          description:
            "Ajuste opcional por periodo como decimal (ej: 0.015 para 1.5%). Si no se envía, se usa el valor por defecto del sistema."
        }
      },
      required: ["principal", "interestRate", "paymentFrequency", "baseDuration"]
    }
  }
};

/**
 * Tool definition for updating a loan's status.
 * Used by the founder copilot only (Maria, the WhatsApp admin agent, was
 * retired in favor of the copilot — mikro/#120).
 */
export const updateLoanStatusTool: ToolFunction = {
  type: "function",
  function: {
    name: "updateLoanStatus",
    description:
      "Cambiar el estado de un préstamo a COMPLETED (completado), DEFAULTED (en mora) o CANCELLED (cancelado). Usa el número de préstamo (loan ID numérico, ej: 10000, 10001).",
    parameters: {
      type: "object",
      properties: {
        loanId: {
          type: "string",
          description:
            "ID numérico del préstamo (ej: 10000, 10001). Este es el número de préstamo, no el UUID."
        },
        status: {
          type: "string",
          description: "Nuevo estado del préstamo",
          enum: ["COMPLETED", "DEFAULTED", "CANCELLED"]
        }
      },
      required: ["loanId", "status"]
    }
  }
};

/**
 * Tool definition for sending the loan-application promo template to a phone,
 * no application created. Used by the founder copilot as a customer-acquisition
 * tool (WRITE_TOOL — the founder confirms via the pending-action card before it runs).
 */
export const sendPromoTool: ToolFunction = {
  type: "function",
  function: {
    name: "sendPromo",
    description:
      "Enviar la plantilla promocional de solicitud de préstamo a un número de teléfono, sin crear ninguna solicitud. Útil para captación de clientes (ej: 'envía la promo al +1809...').",
    parameters: {
      type: "object",
      properties: {
        phone: {
          type: "string",
          description: "Número de teléfono al que enviar la promoción (con o sin código de país)."
        }
      },
      required: ["phone"]
    }
  }
};

/**
 * Tool definition for getting a customer by phone number.
 * Used by Juan (collector).
 */
export const getCustomerByPhoneTool: ToolFunction = {
  type: "function",
  function: {
    name: "getCustomerByPhone",
    description:
      "Obtener información de un cliente por su número de teléfono. El número puede incluir o no el signo +.",
    parameters: {
      type: "object",
      properties: {
        phone: {
          type: "string",
          description: "Número de teléfono del cliente (puede incluir o no el signo +)"
        }
      },
      required: ["phone"]
    }
  }
};

/**
 * Tool definition for getting a loan application (solicitud) by its id.
 * Used by the founder copilot — distinct from getCustomer/getCustomerByPhone,
 * which look up a Customer, not a LoanApplication. The two are different
 * tables with their own UUIDs; this tool exists specifically so a solicitud
 * UUID doesn't get mistaken for (or silently fail against) a customer lookup.
 */
export const getApplicationByIdTool: ToolFunction = {
  type: "function",
  function: {
    name: "getApplicationById",
    description:
      "Obtener los detalles de una solicitud (loan application) por su ID (UUID). Este ID es el de la SOLICITUD, no el del cliente — son tablas distintas. Útil cuando el fundador pregunta por una solicitud específica (ej. desde 'Ver solicitud' en el feed).",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "ID (UUID) de la solicitud a buscar."
        }
      },
      required: ["id"]
    }
  }
};

/**
 * Tool definitions for reviewing a loan application (solicitud) from the founder
 * copilot: approve, reject (with a required, recorded reason), and delete. All
 * three are WRITE_TOOLS — the founder confirms via the pending-action card before
 * anything runs. `id` is the SOLICITUD UUID (as from getApplicationById), not a
 * customer id.
 */
export const approveApplicationTool: ToolFunction = {
  type: "function",
  function: {
    name: "approveApplication",
    description:
      "Aprobar una solicitud (loan application) que está RECEIVED o IN_REVIEW, pasándola a APPROVED. Usa el ID (UUID) de la SOLICITUD. Puedes incluir una nota opcional.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "ID (UUID) de la solicitud a aprobar."
        },
        note: {
          type: "string",
          description: "Nota opcional sobre la aprobación."
        }
      },
      required: ["id"]
    }
  }
};

export const rejectApplicationTool: ToolFunction = {
  type: "function",
  function: {
    name: "rejectApplication",
    description:
      "Rechazar formalmente una solicitud (loan application) que está RECEIVED o IN_REVIEW, pasándola a REJECTED. Conserva el registro y el motivo para auditoría (NO la elimina). Prefiere esta herramienta sobre deleteApplication para declinar a un solicitante. El motivo es OBLIGATORIO. Usa el ID (UUID) de la SOLICITUD.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "ID (UUID) de la solicitud a rechazar."
        },
        reason: {
          type: "string",
          description:
            "Motivo del rechazo. Obligatorio — queda registrado como la nota de revisión."
        }
      },
      required: ["id", "reason"]
    }
  }
};

export const deleteApplicationTool: ToolFunction = {
  type: "function",
  function: {
    name: "deleteApplication",
    description:
      "Eliminar permanentemente una solicitud (loan application). Es IRREVERSIBLE y borra el historial — úsala solo para flujos muertos, spam o abandonados que el fundador quiere purgar. Para declinar a un solicitante real usa rejectApplication (conserva el registro). No se puede eliminar una solicitud CONVERTED. Usa el ID (UUID) de la SOLICITUD.",
    parameters: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "ID (UUID) de la solicitud a eliminar."
        }
      },
      required: ["id"]
    }
  }
};

/**
 * Tool definition for creating an accounting transaction (income, expense, or
 * transfer). Not exposed to any WhatsApp agent persona — reachable only via
 * the founder-copilot chat (mikro/#115: daily cash-reconciliation + books
 * closing), which lists it as a WRITE_TOOL (see
 * `mods/apiserver/src/api/copilot/toolPolicy.ts`). `account`/`toAccount`/
 * `category` accept either the exact name or the UUID — the apiserver wiring
 * resolves names before calling the accounting API.
 */
export const createAccountingTransactionTool: ToolFunction = {
  type: "function",
  function: {
    name: "createAccountingTransaction",
    description:
      "Registrar una transacción contable (ingreso, gasto o transferencia entre cuentas). Úsala para cerrar el día después de reconciliar el efectivo cobrado (getDailyCashCollected) contra el conteo físico del fundador, o para cualquier otro movimiento contable que el fundador pida registrar. account, toAccount y category aceptan el nombre exacto de la cuenta/categoría o su UUID.",
    parameters: {
      type: "object",
      properties: {
        type: {
          type: "string",
          description:
            "Tipo de transacción: INCOME (ingreso), EXPENSE (gasto), TRANSFER (entre cuentas), DEPOSIT o WITHDRAWAL.",
          enum: ["DEPOSIT", "WITHDRAWAL", "EXPENSE", "INCOME", "TRANSFER"]
        },
        account: {
          type: "string",
          description: "Cuenta de origen: nombre exacto (ej: 'Caja principal') o UUID."
        },
        toAccount: {
          type: "string",
          description: "Cuenta de destino (nombre o UUID). Obligatorio solo si type es TRANSFER."
        },
        amount: {
          type: "string",
          description: "Monto de la transacción en pesos dominicanos (positivo)."
        },
        category: {
          type: "string",
          description:
            "Categoría (nombre o UUID). Opcional, solo aplica si type es INCOME o EXPENSE."
        },
        description: {
          type: "string",
          description: "Descripción libre de la transacción. Opcional."
        },
        vendor: {
          type: "string",
          description: "Proveedor o contraparte. Opcional."
        },
        reference: {
          type: "string",
          description: "Referencia externa (ej: número de cheque o factura). Opcional."
        },
        occurredAt: {
          type: "string",
          description: "Fecha en que ocurrió (YYYY-MM-DD). Opcional, por defecto hoy."
        }
      },
      required: ["type", "account", "amount"]
    }
  }
};

/**
 * Tool definition for forcing an on-demand, full-base QCobro portfolio sync
 * (WRITE_TOOL — the founder confirms via the pending-action card before it
 * runs). No arguments: it reruns the exact same full pass the cron worker and
 * the on-payment trigger already use (see createSyncAllPortfolios.ts).
 */
export const forceQCobroSyncTool: ToolFunction = {
  type: "function",
  function: {
    name: "forceQCobroSync",
    description:
      "Forzar una sincronización completa de la cartera con QCobro ahora mismo, sin esperar el próximo tick programado. Corre el mismo proceso que el worker automático (recalcula etiquetas AUTO, evalúa las reglas de portafolio y empuja los cambios a QCobro). Útil después de un cambio masivo de datos o para verificar la integración. No requiere parámetros.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  }
};

/**
 * Tool definition for listing loans by customer ID.
 * Used by Juan (collector).
 */
export const listLoansByCustomerTool: ToolFunction = {
  type: "function",
  function: {
    name: "listLoansByCustomer",
    description: "Listar todos los préstamos de un cliente específico por su ID.",
    parameters: {
      type: "object",
      properties: {
        customerId: {
          type: "string",
          description: "ID del cliente"
        },
        showAll: {
          type: "string",
          description:
            "Si es 'true', muestra todos los préstamos incluyendo los completados. Por defecto solo muestra activos."
        }
      },
      required: ["customerId"]
    }
  }
};

/**
 * Tool definition for listing loans by customer phone number.
 * Used by Juan (collector) and the founder Copilot (issue #119). This is a
 * convenience tool that combines getCustomerByPhone and listLoansByCustomer
 * into a single call.
 */
export const listCustomerLoansByPhoneTool: ToolFunction = {
  type: "function",
  function: {
    name: "listCustomerLoansByPhone",
    description:
      "Listar todos los préstamos de un cliente por su número de teléfono. El número puede incluir o no el signo +. Esta herramienta busca el cliente por teléfono y luego lista sus préstamos.",
    parameters: {
      type: "object",
      properties: {
        phone: {
          type: "string",
          description: "Número de teléfono del cliente (puede incluir o no el signo +)"
        },
        showAll: {
          type: "string",
          description:
            "Si es 'true', muestra todos los préstamos incluyendo los completados. Por defecto solo muestra activos."
        }
      },
      required: ["phone"]
    }
  }
};

/**
 * Tool definition for getting loan information by loan ID.
 * Used by Juan (collector) to get loan details including payment amount before creating a payment.
 */
export const getLoanByLoanIdTool: ToolFunction = {
  type: "function",
  function: {
    name: "getLoanByLoanId",
    description:
      "Obtener información detallada de un préstamo usando el número de préstamo (loan ID numérico, ej: 10000, 10001). Incluye información del cliente, monto del préstamo, monto de pago esperado, frecuencia de pago, y estado.",
    parameters: {
      type: "object",
      properties: {
        loanId: {
          type: "string",
          description:
            "ID numérico del préstamo (ej: 10000, 10001). Este es el número de préstamo, no el UUID."
        }
      },
      required: ["loanId"]
    }
  }
};

/**
 * Tool definition for previewing accrued mora (past-due fee) for a loan.
 */
export const previewLateFeeTool: ToolFunction = {
  type: "function",
  function: {
    name: "previewLateFee",
    description:
      "Consultar la mora (past-due fee) acumulada de un préstamo. Devuelve cuota, mora bruta, mora ya cobrada, mora neta a cobrar, días de atraso, ciclos atrasados, tasa y total sugerido (cuota + mora neta).",
    parameters: {
      type: "object",
      properties: {
        loanId: {
          type: "string",
          description:
            "ID numérico del préstamo (ej: 10000, 10001). Este es el número de préstamo, no el UUID."
        },
        asOf: {
          type: "string",
          description: "Fecha de corte opcional en formato YYYY-MM-DD (por defecto hoy)."
        }
      },
      required: ["loanId"]
    }
  }
};

/**
 * Tool definition for listing payments by loan ID.
 * Used by Juan (collector) to see payment history and get payment IDs for sending receipts.
 */
export const listPaymentsByLoanIdTool: ToolFunction = {
  type: "function",
  function: {
    name: "listPaymentsByLoanId",
    description:
      "Listar los pagos de un préstamo usando el número de préstamo (loan ID numérico, ej: 10000, 10001). Útil para ver el historial de pagos y obtener el ID del último pago para enviar recibos. Los pagos se muestran del más reciente al más antiguo.",
    parameters: {
      type: "object",
      properties: {
        loanId: {
          type: "string",
          description:
            "ID numérico del préstamo (ej: 10000, 10001). Este es el número de préstamo, no el UUID."
        },
        limit: {
          type: "string",
          description:
            "Número máximo de pagos a mostrar (opcional, por defecto muestra los más recientes). Para obtener solo el último pago, usa limit: '1'."
        }
      },
      required: ["loanId"]
    }
  }
};

/**
 * Tool definition for listing users.
 * Used by the founder copilot (Maria, the WhatsApp admin agent, was retired
 * in favor of the copilot — mikro/#120) to find referrers and collectors.
 */
export const listUsersTool: ToolFunction = {
  type: "function",
  function: {
    name: "listUsers",
    description:
      "Listar todos los usuarios disponibles. Útil para encontrar cobradores (COLLECTOR) y administradores (ADMIN). Los usuarios incluyen sus roles.",
    parameters: {
      type: "object",
      properties: {
        role: {
          type: "string",
          description:
            "Filtrar usuarios por rol: 'COLLECTOR' para cobradores, 'ADMIN' para administradores, 'REVIEWER' para revisores. Si no se especifica, muestra todos los usuarios.",
          enum: ["ADMIN", "COLLECTOR", "REVIEWER"]
        }
      },
      required: []
    }
  }
};

// ── José intake tools ──────────────────────────────────────────────────────

export const getApplicationStateTool: ToolFunction = {
  type: "function",
  function: {
    name: "getApplicationState",
    description:
      "Obtener el estado actual de la solicitud del prospecto: campos completados, campos faltantes, puntuación simulada (ISC) y si existe alguna razón para rechazar (fuera de zona, tipo de negocio crítico). Llamar al inicio de cada turno para tener la información más reciente.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  }
};

export const saveAnswerTool: ToolFunction = {
  type: "function",
  function: {
    name: "saveAnswer",
    description:
      "Guardar la respuesta del prospecto para uno o más campos de la solicitud. Llama esta herramienta después de cada respuesta válida antes de hacer la siguiente pregunta. No llames si la respuesta no es válida para el campo.",
    parameters: {
      type: "object",
      properties: {
        fields: {
          type: "object",
          description:
            "Objeto con pares campo:valor. Claves válidas: firstName, lastName, phone, idNumber, dateOfBirth, maritalStatus, businessType, businessName, requestedAmount, purpose, requestedTermWeeks, province, homeAddress, businessAge, monthlySales, locationType, formalization, employeeCount, businessPhone, spouseName, spousePhone, referenceName, referencePhone, housingType, residenceTime, addressReference"
        }
      },
      required: ["fields"]
    }
  }
};

export const finalizeApplicationTool: ToolFunction = {
  type: "function",
  function: {
    name: "finalizeApplication",
    description:
      "Cerrar la solicitud del prospecto. No envía ningún mensaje: el mensaje de cierre lo escribes tú como respuesta. Usa outcome 'complete' cuando la solicitud queda lista para revisión (ISC >= 50, todos los campos aplicables recopilados, fuera de zona, o negocio crítico). Usa outcome 'abandoned' cuando el prospecto dice que NO está interesado / no quiere continuar, o cuando lleva varios turnos sin responder. NUNCA llames esta herramienta más de una vez.",
    parameters: {
      type: "object",
      properties: {
        outcome: {
          type: "string",
          enum: ["complete", "abandoned"],
          description:
            "'complete' = lista para que un asesor la revise. 'abandoned' = el prospecto no está interesado o no respondió. Por defecto 'complete'."
        }
      },
      required: []
    }
  }
};

/**
 * All available tools.
 */
export const allTools: ToolFunction[] = [
  createCustomerTool,
  createPaymentTool,
  sendReceiptViaWhatsAppTool,
  listPaymentsByLoanIdTool,
  listLoansByCollectorTool,
  getCustomerTool,
  createLoanTool,
  calculateLoanTool,
  updateLoanStatusTool,
  sendPromoTool,
  getCustomerByPhoneTool,
  getApplicationByIdTool,
  approveApplicationTool,
  rejectApplicationTool,
  deleteApplicationTool,
  forceQCobroSyncTool,
  createAccountingTransactionTool,
  listLoansByCustomerTool,
  listCustomerLoansByPhoneTool,
  listUsersTool,
  getLoanByLoanIdTool,
  previewLateFeeTool,
  getApplicationStateTool,
  saveAnswerTool,
  finalizeApplicationTool
];

/**
 * Get tools by name.
 */
export function getToolByName(name: string): ToolFunction | undefined {
  return allTools.find((tool) => tool.function.name === name);
}
