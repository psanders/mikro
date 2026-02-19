/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Tool definitions for OpenAI function calling.
 * These define what tools the LLM can call and their parameters.
 */
import type { ToolFunction } from "../llm/types.js";

/**
 * Tool definition for creating a new customer.
 * Used by Joan (guest onboarding) and Maria (admin).
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
        referredById: {
          type: "string",
          description:
            "ID del referidor (UUID). REQUERIDO. Proceso: 1) Pregunta al usuario '¿Quién te refirió?' o '¿Quién te habló de Mikro Créditos?', 2) Llama listUsers con role='REFERRER' para obtener la lista de referidores disponibles con sus IDs, 3) Haz coincidir el nombre proporcionado por el usuario con uno de la lista, 4) Si no estás seguro, muestra las opciones al usuario y confirma, 5) Usa el ID (campo 'id') del referidor seleccionado aquí."
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
        }
      },
      required: ["name", "idNumber", "homeAddress", "referredById"]
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
 * Used by Juan (collector).
 *
 * This is the tool for sending receipts to the collector (requestor).
 * It generates the receipt, saves it to disk, and sends it via WhatsApp automatically.
 */
export const sendReceiptViaWhatsAppTool: ToolFunction = {
  type: "function",
  function: {
    name: "sendReceiptViaWhatsApp",
    description:
      "Generar y enviar un recibo por WhatsApp al cobrador (la persona que solicita el recibo). Esta es la herramienta RECOMENDADA para enviar recibos. Genera el recibo, lo guarda en el servidor y lo envía automáticamente por WhatsApp al teléfono del cobrador. IMPORTANTE: Esta herramienta REQUIERE el paymentId de la respuesta de createPayment. DEBES llamar createPayment primero y esperar su respuesta antes de llamar esta herramienta.",
    parameters: {
      type: "object",
      properties: {
        paymentId: {
          type: "string",
          description:
            "ID del pago (UUID) para el cual enviar el recibo. Debe ser un UUID válido en formato xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx. Este es el ID del pago, NO el número de préstamo. Puedes obtener el paymentId del resultado de createPayment."
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
 * Used by Maria (admin).
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
          description: "Frecuencia de pago: WEEKLY o DAILY",
          enum: ["WEEKLY", "DAILY"]
        }
      },
      required: ["customerId", "principal", "termLength", "paymentAmount", "paymentFrequency"]
    }
  }
};

/**
 * Tool definition for calculating loan payment options.
 * Used by Maria (admin).
 */
export const calculateLoanTool: ToolFunction = {
  type: "function",
  function: {
    name: "calculateLoan",
    description:
      "Calcular opciones de préstamo con diferentes duraciones usando una tasa base y ajuste por periodo. Recibe monto, tasa de interés total, frecuencia (DAILY o WEEKLY) y duración base.",
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
          description: "Frecuencia de pago: DAILY o WEEKLY",
          enum: ["DAILY", "WEEKLY"]
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
 * Used by Maria (admin) only.
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
 * Used by Juan (collector). This is a convenience tool that combines getCustomerByPhone and listLoansByCustomer.
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
 * Used by Joan (guest onboarding) and Maria (admin) to find referrers and collectors.
 */
export const listUsersTool: ToolFunction = {
  type: "function",
  function: {
    name: "listUsers",
    description:
      "Listar todos los usuarios disponibles. Útil para encontrar referidores (REFERRER) y cobradores (COLLECTOR) al crear un nuevo cliente. Los usuarios incluyen sus roles.",
    parameters: {
      type: "object",
      properties: {
        role: {
          type: "string",
          description:
            "Filtrar usuarios por rol: 'REFERRER' para referidores, 'COLLECTOR' para cobradores, 'ADMIN' para administradores. Si no se especifica, muestra todos los usuarios.",
          enum: ["ADMIN", "COLLECTOR", "REFERRER"]
        }
      },
      required: []
    }
  }
};

/**
 * Tool definition for exporting collector customers.
 * Used by Juan (collector) to generate a report of assigned customers.
 */
export const exportCollectorCustomersTool: ToolFunction = {
  type: "function",
  function: {
    name: "exportCollectorCustomers",
    description:
      "Generar un reporte de los clientes asignados al cobrador. Incluye: Nombre, Telefono, Prestamo, Rating, Pagos atrasados, Tendencia, Referidor, Punto de Cobro y Notas.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  }
};

/**
 * Tool definition for exporting customers by referrer.
 * Used by referrers to generate a report of customers they referred.
 */
export const exportCustomersByReferrerTool: ToolFunction = {
  type: "function",
  function: {
    name: "exportCustomersByReferrer",
    description:
      "Generar un reporte de los clientes referidos por el usuario. Incluye: Nombre, Telefono, Prestamo, Rating, Pagos atrasados, Tendencia, Referidor, Punto de Cobro y Notas.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  }
};

/**
 * Tool definition for exporting all customers (admin only).
 * Used by admin to generate a report of all active customers.
 */
export const exportAllCustomersTool: ToolFunction = {
  type: "function",
  function: {
    name: "exportAllCustomers",
    description:
      "Generar un reporte de todos los clientes activos (solo admin). Por defecto envia una imagen agrupada por estado de pago (simplified). Con format 'detailed' envia Excel con todos los datos: Nombre, Telefono, Prestamo, Rating, Pagos atrasados, Tendencia, Referidor, Punto de Cobro y Notas.",
    parameters: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["simplified", "detailed"],
          description:
            "Formato del reporte: 'simplified' (imagen para WhatsApp, por defecto) o 'detailed' (Excel con todos los datos)"
        }
      },
      required: []
    }
  }
};

/**
 * Tool definition for generating a one-page performance report (portfolio metrics + narrative + PNG).
 * Admin only. Sends the report image via WhatsApp.
 */
export const generatePerformanceReportTool: ToolFunction = {
  type: "function",
  function: {
    name: "generatePerformanceReport",
    description:
      "Generar un reporte de rendimiento del portafolio (una pagina con metricas, resumen ejecutivo y graficos). Solo admin. Se envia por WhatsApp como imagen.",
    parameters: {
      type: "object",
      properties: {
        startDate: {
          type: "string",
          description: "Fecha de inicio del periodo (YYYY-MM-DD). Opcional."
        },
        endDate: {
          type: "string",
          description: "Fecha de fin del periodo (YYYY-MM-DD). Opcional."
        }
      },
      required: []
    }
  }
};

/**
 * Tool definition for running a single collection action (reminder, overdue notice, or call) for one loan.
 * Admin only. Can force channel and/or type, or let the system auto-determine from missed payments.
 */
export const runSingleCollectionTool: ToolFunction = {
  type: "function",
  function: {
    name: "runSingleCollection",
    description:
      "Enviar una accion de cobro a un solo prestamo: recordatorio de pago (PAYMENT_REMINDER), aviso de mora (OVERDUE_NOTICE) o llamada de cobro (COLLECTION_CALL). Usa el numero de prestamo (loanId). Opcional: forzar canal (WHATSAPP o PHONE_CALL) y/o tipo. Si no se especifica tipo, se determina por pagos atrasados.",
    parameters: {
      type: "object",
      properties: {
        loanId: {
          type: "string",
          description:
            "ID numerico del prestamo (ej: 10019). Este es el numero de prestamo, no el UUID."
        },
        channel: {
          type: "string",
          enum: ["WHATSAPP", "PHONE_CALL"],
          description:
            "Canal a usar (opcional). Por defecto: WHATSAPP para recordatorio/aviso, PHONE_CALL para llamada."
        },
        type: {
          type: "string",
          enum: ["PAYMENT_REMINDER", "OVERDUE_NOTICE", "COLLECTION_CALL"],
          description:
            "Tipo de accion (opcional). Por defecto se calcula: 0 atrasos + dia de pago = recordatorio; 1-2 atrasos = aviso; 3+ = llamada."
        }
      },
      required: ["loanId"]
    }
  }
};

/**
 * Tool definition for generating a defaulted loans report (PNG sent via WhatsApp).
 * Admin only. Shows all DEFAULTED loans with AI-generated note summaries.
 */
export const generateDefaultedReportTool: ToolFunction = {
  type: "function",
  function: {
    name: "generateDefaultedReport",
    description:
      "Generar un reporte de prestamos en mora (defaulted). Muestra todos los prestamos con estado DEFAULTED, incluyendo resumen de notas generado por IA. Solo admin. Se envia por WhatsApp como imagen.",
    parameters: {
      type: "object",
      properties: {},
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
  getCustomerByPhoneTool,
  listLoansByCustomerTool,
  listCustomerLoansByPhoneTool,
  listUsersTool,
  getLoanByLoanIdTool,
  exportCollectorCustomersTool,
  exportCustomersByReferrerTool,
  exportAllCustomersTool,
  generatePerformanceReportTool,
  generateDefaultedReportTool,
  runSingleCollectionTool
];

/**
 * Get tools by name.
 */
export function getToolByName(name: string): ToolFunction | undefined {
  return allTools.find((tool) => tool.function.name === name);
}
