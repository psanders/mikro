/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * José tool: finalizeApplication — marks the application as complete
 * (partial: false) and sends the closing WhatsApp message to the prospect.
 */
import type { DbClient, NormalizedApplication, SendWhatsAppMessageInput } from "@mikro/common";
import { normalizeApplication } from "@mikro/common";
import type { ToolResult } from "@mikro/agents";
import { logger } from "../../logger.js";

const CLOSING_MESSAGE_WITH_NAME = (name: string) =>
  `¡Listo, ${name}! Tu información está completa. Un asesor de Mikro la revisará y te contactará en horario laboral (lunes a viernes). Si nos escribes en fin de semana, respondemos el lunes. ¡Gracias por tu interés!`;

const CLOSING_MESSAGE_WITHOUT_NAME =
  "¡Listo! Tu información está completa. Un asesor de Mikro la revisará y te contactará en horario laboral (lunes a viernes). Si nos escribes en fin de semana, respondemos el lunes. ¡Gracias por tu interés!";

export function createFinalizeApplication(
  client: DbClient,
  upsertApplication: (input: NormalizedApplication) => Promise<unknown>,
  sendWhatsAppMessage: (params: SendWhatsAppMessageInput) => Promise<unknown>
) {
  return async (
    _args: Record<string, unknown>,
    context?: Record<string, unknown>
  ): Promise<ToolResult> => {
    const sessionId = context?.sessionId as string | undefined;
    const phone = context?.phone as string | undefined;

    if (!sessionId || !phone) {
      return { success: false, message: "No sessionId or phone in context" };
    }

    try {
      const existing = await client.loanApplication.findFirst({
        where: { sessionId }
      });

      if (!existing) {
        return { success: false, message: `Application not found: ${sessionId}` };
      }

      const existingRaw = (existing.rawData as Record<string, unknown>) ?? {};

      const payload = {
        sessionId,
        partial: false,
        ...existingRaw,
        firstName: existing.firstName ?? undefined,
        lastName: existing.lastName ?? undefined,
        phone: existing.phone ?? undefined,
        idNumber: existing.idNumber ?? undefined,
        maritalStatus: existing.maritalStatus ?? undefined,
        businessType: existing.businessType ?? undefined,
        businessName: existing.businessName ?? undefined,
        requestedAmount:
          existing.requestedAmount != null ? String(existing.requestedAmount) : undefined,
        purpose: existing.purpose ?? undefined,
        requestedTermWeeks:
          existing.requestedTermWeeks != null ? String(existing.requestedTermWeeks) : undefined,
        province: existing.province ?? undefined,
        homeAddress: existing.homeAddress ?? undefined
      };

      const normalized = normalizeApplication(payload);
      await upsertApplication(normalized);

      const firstName = existing.firstName;
      const message = firstName
        ? CLOSING_MESSAGE_WITH_NAME(firstName)
        : CLOSING_MESSAGE_WITHOUT_NAME;

      await sendWhatsAppMessage({ phone, message });

      logger.info("jose finalizeApplication: application finalized", { sessionId, phone });

      return {
        success: true,
        message: "Solicitud finalizada",
        data: { finalized: true }
      };
    } catch (err) {
      logger.error("jose finalizeApplication failed", { sessionId, error: (err as Error).message });
      return { success: false, message: (err as Error).message };
    }
  };
}
