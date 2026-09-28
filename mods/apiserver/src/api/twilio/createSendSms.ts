/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Send one SMS through Twilio's Messages API. Plain fetch, no SDK. Best-effort:
 * returns whether Twilio accepted the message and never throws.
 */
import { logger } from "../../logger.js";

const TWILIO_API_BASE_URL = "https://api.twilio.com/2010-04-01";

export interface SendSmsDeps {
  accountSid: string;
  authToken: string;
  /** An E.164 Twilio number, or a Messaging Service SID ("MG…"). */
  from: string;
  /** Injected so tests never reach the network. */
  fetchFn?: typeof fetch;
}

export type SendSms = (to: string, body: string) => Promise<boolean>;

export function createSendSms(deps: SendSmsDeps): SendSms {
  const { accountSid, authToken, from, fetchFn = fetch } = deps;
  const configured = Boolean(accountSid && authToken && from);

  return async (to, body) => {
    if (!configured) return false;
    const form = new URLSearchParams({ To: to, Body: body });
    form.set(from.startsWith("MG") ? "MessagingServiceSid" : "From", from);
    try {
      const res = await fetchFn(`${TWILIO_API_BASE_URL}/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: form.toString()
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { code?: number; message?: string };
        logger.error("twilio sms rejected", {
          status: res.status,
          code: err.code,
          error: err.message
        });
        return false;
      }
      return true;
    } catch (err) {
      logger.error("twilio sms failed", { error: (err as Error).message });
      return false;
    }
  };
}
