/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Text the applicant the configured rejection message (mikro.json
 * `twilio.rejectionMessage`) after a reviewer or admin rejects their
 * application. Applicants with no phone (WhatsApp BSUID only) are skipped.
 * Never throws.
 */
import type { LoanApplication, TwilioConfig } from "@mikro/common";
import { logger } from "../../logger.js";
import { createSendSms } from "../twilio/index.js";

export interface NotifyRejectionDeps extends TwilioConfig {
  /** Injected so tests never reach the network. */
  fetchFn?: typeof fetch;
}

export function createNotifyRejection(deps: NotifyRejectionDeps) {
  const sendSms = createSendSms(deps);
  const message = deps.rejectionMessage;

  return async (app: Pick<LoanApplication, "id" | "phone">): Promise<boolean> => {
    if (!message) return false;
    if (!app.phone) {
      logger.verbose("rejection sms skipped: application has no phone", {
        applicationId: app.id
      });
      return false;
    }
    const sent = await sendSms(app.phone, message);
    logger.verbose("rejection sms", { applicationId: app.id, sent });
    return sent;
  };
}
