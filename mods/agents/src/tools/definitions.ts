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
    description: "Crear una nueva cuenta de miembro después de recopilar toda la información requerida. El nombre y número de cédula DEBEN ser extraídos de las fotos de la cédula.",
    parameters: {
      type: "object",
      properties: {
        phone: {
          type: "string",
          description: "Número de teléfono del miembro (se proporciona automáticamente del contexto)"
        },
        referrerName: {
          type: "string",
          description: "Nombre de la persona que refirió al cliente"
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
          description: "Dirección del punto de cobro"
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
      required: ["name", "idNumber", "collectionPoint", "homeAddress"]
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
          description: "Si es 'true', muestra todos los préstamos incluyendo los completados. Por defecto solo muestra activos."
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
 * All available tools.
 */
export const allTools: ToolFunction[] = [
  createMemberTool,
  createPaymentTool,
  generateReceiptTool,
  listLoansByCollectorTool,
  getMemberTool,
  createLoanTool
];

/**
 * Get tools by name.
 */
export function getToolByName(name: string): ToolFunction | undefined {
  return allTools.find(tool => tool.function.name === name);
}
