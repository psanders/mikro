/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Tool definitions for OpenAI function calling.
 * These define what tools the LLM can call and their parameters.
 */
import type { ToolFunction } from "../llm/types.js";

/**
 * Tool definition for creating a new member.
 * Used by Joan (guest onboarding) and Maria (admin).
 */
export const createMemberTool: ToolFunction = {
  type: "function",
  function: {
    name: "createMember",
    description:
      "Crear una nueva cuenta de miembro después de recopilar toda la información requerida. El nombre y número de cédula DEBEN ser extraídos de las fotos de la cédula.",
    parameters: {
      type: "object",
      properties: {
        phone: {
          type: "string",
          description:
            "Número de teléfono del miembro (se proporciona automáticamente del contexto)"
        },
        referredById: {
          type: "string",
          description:
            "ID del referidor (UUID). REQUERIDO. Proceso: 1) Pregunta al usuario '¿Quién te refirió?' o '¿Quién te habló de Mikro Créditos?', 2) Llama listUsers con role='REFERRER' para obtener la lista de referidores disponibles con sus IDs, 3) Haz coincidir el nombre proporcionado por el usuario con uno de la lista, 4) Si no estás seguro, muestra las opciones al usuario y confirma, 5) Usa el ID (campo 'id') del referidor seleccionado aquí."
        },
        name: {
          type: "string",
          description: "Nombre completo del miembro extraído de la cédula de identidad"
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
          description: "Dirección del hogar del miembro"
        },
        jobPosition: {
          type: "string",
          description: "Empleo actual del miembro"
        },
        income: {
          type: "string",
          description: "Ingresos aproximados del miembro"
        },
        isBusinessOwner: {
          type: "string",
          description: "Indica si el miembro es propietario de un negocio (true/false)"
        }
      },
      required: ["name", "idNumber", "homeAddress", "referredById"]
    }
  }
};

/**
 * Tool definition for creating a payment (complete workflow).
 * Used by Juan (collector). This tool handles the complete payment registration:
 * gets loan by loan ID (numeric), retrieves member information, validates collector assignment,
 * creates payment, and generates receipt.
 */
export const createPaymentTool: ToolFunction = {
  type: "function",
  function: {
    name: "createPayment",
    description:
      "Registrar un nuevo pago para un préstamo usando el número de préstamo (loan ID numérico, ej: 10000, 10001). Esta herramienta obtiene el préstamo, recupera la información del miembro, valida que el cobrador esté asignado, crea el pago y genera el recibo automáticamente.",
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
 * Tool definition for getting member information.
 * Used by Juan (collector).
 */
export const getMemberTool: ToolFunction = {
  type: "function",
  function: {
    name: "getMember",
    description: "Obtener información detallada de un miembro específico.",
    parameters: {
      type: "object",
      properties: {
        memberId: {
          type: "string",
          description: "ID del miembro a buscar"
        }
      },
      required: ["memberId"]
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
    description: "Crear un nuevo préstamo para un miembro existente.",
    parameters: {
      type: "object",
      properties: {
        memberId: {
          type: "string",
          description: "ID del miembro que recibe el préstamo"
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
      required: ["memberId", "principal", "termLength", "paymentAmount", "paymentFrequency"]
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
 * Tool definition for getting a member by phone number.
 * Used by Juan (collector).
 */
export const getMemberByPhoneTool: ToolFunction = {
  type: "function",
  function: {
    name: "getMemberByPhone",
    description:
      "Obtener información de un miembro por su número de teléfono. El número puede incluir o no el signo +.",
    parameters: {
      type: "object",
      properties: {
        phone: {
          type: "string",
          description: "Número de teléfono del miembro (puede incluir o no el signo +)"
        }
      },
      required: ["phone"]
    }
  }
};

/**
 * Tool definition for listing loans by member ID.
 * Used by Juan (collector).
 */
export const listLoansByMemberTool: ToolFunction = {
  type: "function",
  function: {
    name: "listLoansByMember",
    description: "Listar todos los préstamos de un miembro específico por su ID.",
    parameters: {
      type: "object",
      properties: {
        memberId: {
          type: "string",
          description: "ID del miembro"
        },
        showAll: {
          type: "string",
          description:
            "Si es 'true', muestra todos los préstamos incluyendo los completados. Por defecto solo muestra activos."
        }
      },
      required: ["memberId"]
    }
  }
};

/**
 * Tool definition for listing loans by member phone number.
 * Used by Juan (collector). This is a convenience tool that combines getMemberByPhone and listLoansByMember.
 */
export const listMemberLoansByPhoneTool: ToolFunction = {
  type: "function",
  function: {
    name: "listMemberLoansByPhone",
    description:
      "Listar todos los préstamos de un miembro por su número de teléfono. El número puede incluir o no el signo +. Esta herramienta busca el miembro por teléfono y luego lista sus préstamos.",
    parameters: {
      type: "object",
      properties: {
        phone: {
          type: "string",
          description: "Número de teléfono del miembro (puede incluir o no el signo +)"
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
      "Obtener información detallada de un préstamo usando el número de préstamo (loan ID numérico, ej: 10000, 10001). Incluye información del miembro, monto del préstamo, monto de pago esperado, frecuencia de pago, y estado.",
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
      "Listar todos los usuarios disponibles. Útil para encontrar referidores (REFERRER) y cobradores (COLLECTOR) al crear un nuevo miembro. Los usuarios incluyen sus roles.",
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
 * Tool definition for exporting collector members.
 * Used by Juan (collector) to generate a report of assigned members.
 */
export const exportCollectorMembersTool: ToolFunction = {
  type: "function",
  function: {
    name: "exportCollectorMembers",
    description:
      "Generar un reporte de los miembros asignados al cobrador. Incluye: Nombre, Telefono, Prestamo, Referidor, Punto de Cobro, Notas del Miembro, Notas del Prestamo, y Dias de Atraso.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  }
};

/**
 * Tool definition for exporting members by referrer.
 * Used by referrers to generate a report of members they referred.
 */
export const exportMembersByReferrerTool: ToolFunction = {
  type: "function",
  function: {
    name: "exportMembersByReferrer",
    description:
      "Generar un reporte de los miembros referidos por el usuario. Incluye: Nombre, Telefono, Prestamo, Referidor, Punto de Cobro, Estado de Pago, y Notas.",
    parameters: {
      type: "object",
      properties: {},
      required: []
    }
  }
};

/**
 * Tool definition for exporting all members (admin only).
 * Used by admin to generate a report of all active members.
 */
export const exportAllMembersTool: ToolFunction = {
  type: "function",
  function: {
    name: "exportAllMembers",
    description:
      "Generar un reporte de todos los miembros activos (solo admin). Incluye: Nombre, Telefono, Prestamo, Referidor, Punto de Cobro, Estado de Pago, y Notas.",
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
  createMemberTool,
  createPaymentTool,
  sendReceiptViaWhatsAppTool,
  listPaymentsByLoanIdTool,
  listLoansByCollectorTool,
  getMemberTool,
  createLoanTool,
  updateLoanStatusTool,
  getMemberByPhoneTool,
  listLoansByMemberTool,
  listMemberLoansByPhoneTool,
  listUsersTool,
  getLoanByLoanIdTool,
  exportCollectorMembersTool,
  exportMembersByReferrerTool,
  exportAllMembersTool
];

/**
 * Get tools by name.
 */
export function getToolByName(name: string): ToolFunction | undefined {
  return allTools.find((tool) => tool.function.name === name);
}
