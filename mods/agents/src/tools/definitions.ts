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
            "URL del punto de cobro (debe ser una URL válida, por ejemplo: https://maps.google.com/?q=Dirección)"
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
      required: ["name", "idNumber", "collectionPoint", "homeAddress", "referredById"]
    }
  }
};

/**
 * Tool definition for creating a payment.
 * Used by Juan (collector).
 */
export const createPaymentTool: ToolFunction = {
  type: "function",
  function: {
    name: "createPayment",
    description: "Registrar un nuevo pago para un préstamo.",
    parameters: {
      type: "object",
      properties: {
        loanId: {
          type: "string",
          description: "ID del préstamo"
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
 * Tool definition for generating a receipt.
 * Used by Juan (collector).
 */
export const generateReceiptTool: ToolFunction = {
  type: "function",
  function: {
    name: "generateReceipt",
    description: "Generar un recibo para un pago existente. Devuelve una imagen del recibo.",
    parameters: {
      type: "object",
      properties: {
        paymentId: {
          type: "string",
          description: "ID del pago para el cual generar el recibo"
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
 * All available tools.
 */
export const allTools: ToolFunction[] = [
  createMemberTool,
  createPaymentTool,
  generateReceiptTool,
  listLoansByCollectorTool,
  getMemberTool,
  createLoanTool,
  getMemberByPhoneTool,
  listLoansByMemberTool,
  listMemberLoansByPhoneTool,
  listUsersTool
];

/**
 * Get tools by name.
 */
export function getToolByName(name: string): ToolFunction | undefined {
  return allTools.find((tool) => tool.function.name === name);
}
