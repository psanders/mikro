/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { ToolResult } from "../../llm/types.js";
import type { ToolExecutorDependencies } from "./types.js";
import { logger } from "../../logger.js";
import { ValidationError } from "@mikro/common";

export async function handleSendReceiptViaWhatsApp(
  deps: ToolExecutorDependencies,
  args: Record<string, unknown>,
  context?: Record<string, unknown>
): Promise<ToolResult> {
  try {
    const paymentId = args.paymentId as string;

    // Validate paymentId is a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!paymentId || !uuidRegex.test(paymentId)) {
      return {
        success: false,
        message: `ID de pago inválido: "${paymentId}". El ID debe ser un UUID válido (formato: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx). Asegúrate de usar el ID del pago, no el número de préstamo.`
      };
    }

    // Get collector's phone from context (the person requesting the receipt)
    const collectorPhone = (context?.phone as string) || undefined;
    if (!collectorPhone) {
      return {
        success: false,
        message:
          "No se pudo obtener el número de teléfono del cobrador. Por favor, intenta de nuevo."
      };
    }

    // Send receipt to the collector (requestor)
    const result = await deps.sendReceiptViaWhatsApp({
      paymentId,
      phone: collectorPhone // Send to collector who requested it
    });

    logger.verbose("receipt sent via whatsapp via tool", {
      paymentId,
      success: result.success,
      messageId: result.messageId
    });

    if (result.success) {
      return {
        success: true,
        message: "Aquí está el recibo solicitado.",
        data: {
          messageId: result.messageId
          // Note: imageUrl is not included - the image is already sent via WhatsApp
        }
      };
    } else {
      return {
        success: false,
        message: `Error al enviar el recibo por WhatsApp: ${result.error || "Error desconocido"}`
      };
    }
  } catch (error) {
    // Handle ValidationError from withErrorHandlingAndValidation
    if (error instanceof ValidationError) {
      logger.error("validation error in sendReceiptViaWhatsApp", {
        error: error.message,
        fieldErrors: error.fieldErrors
      });
      return {
        success: false,
        message: `Error de validación: ${error.message}. Asegúrate de usar un ID de pago válido (UUID).`
      };
    }

    // Re-throw other errors
    throw error;
  }
}
