/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import type { SendWhatsAppTemplateInput, WhatsAppSendResponse } from "@mikro/common";
import { logger } from "../logger.js";

export interface NudgeResult {
  sent: boolean;
  messageId?: string;
  error?: string;
}

interface Deps {
  sendTemplateMessage: (params: SendWhatsAppTemplateInput) => Promise<WhatsAppSendResponse>;
  templateName: string;
  languageCode: string;
}

/** Send the follow-up nudge template to a phone. Text-only, no image, no flow button.
 *  Best-effort: never throws; returns { sent: false, error } on failure. */
export function createSendFollowUpNudge(deps: Deps) {
  return async (phone: string, firstName?: string | null): Promise<NudgeResult> => {
    const bodyParameters = [{ parameter_name: "name", text: firstName ?? "Estimado(a)" }];
    try {
      const res = await deps.sendTemplateMessage({
        phone,
        templateName: deps.templateName,
        languageCode: deps.languageCode,
        headerParameters: [],
        bodyParameters
      });
      const messageId = res.messages?.[0]?.id;
      logger.info("follow-up nudge sent", { phone, messageId });
      return { sent: true, messageId };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error("failed to send follow-up nudge", { phone, error });
      return { sent: false, error };
    }
  };
}
