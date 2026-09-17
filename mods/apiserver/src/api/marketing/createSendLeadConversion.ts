/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Meta Conversions API: the server-side copy of the `Lead` event the browser
 * pixel already sends from `site/src/lib/metaPixel.ts`.
 *
 * Why both: the browser copy is lost whenever an ad blocker, Safari's tracking
 * prevention or a declined cookie banner stops `fbevents.js` — typically 10-30%
 * of events. The server copy always arrives. They are NOT two conversions:
 * the form generates one `eventId`, passes it to `fbq` as `eventID` and posts it
 * here, and Meta collapses the pair. Send a server event without that shared id
 * and Meta counts the lead twice, which makes cost per lead read about half its
 * true value — the failure this whole design exists to avoid.
 *
 * On applicant data: Meta matches conversions to people using hashed
 * identifiers. Mikro sends SHA-256 of phone, first name and last name, decided
 * deliberately (psanders/mikro#278) — the intake form has no email field, which
 * would otherwise be the strongest key. Hashing pseudonymizes rather than
 * anonymizes, so `hash()` is the only path by which any applicant value may
 * leave this process: never add a raw identifier to `user_data`.
 */
import { createHash } from "crypto";
import { logger } from "../../logger.js";

/** Meta's Marketing API version. Pinned: the payload shape is version-specific. */
const GRAPH_API_VERSION = "v21.0";

/** A lead ready to report, assembled by the caller from the application intake. */
export interface LeadConversion {
  /** Shared with the browser's `fbq(..., { eventID })`. Required for dedup. */
  eventId: string;
  /** E.164 as `parsePhone` produces it ("+18298717987"), or null. */
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  /** Meta's click id cookie (`_fbc`) and browser id cookie (`_fbp`). */
  fbc: string | null;
  fbp: string | null;
  /** The applicant's IP and user agent, read from the request, not the body. */
  clientIpAddress: string | null;
  clientUserAgent: string | null;
  /** The page the form was submitted from. */
  eventSourceUrl: string | null;
  /** When the lead happened. Defaults to now; Meta rejects events over 7 days old. */
  eventTime?: Date;
}

export interface SendLeadConversionDeps {
  /** The dataset id. Must match the site's `VITE_META_PIXEL_ID`. */
  pixelId: string;
  accessToken: string;
  /** Set only while verifying in Events Manager; tags events as test traffic. */
  testEventCode?: string;
  /** Injected so tests never reach the network. */
  fetchFn?: typeof fetch;
  now?: () => Date;
}

/**
 * SHA-256 hex of a normalized value, which is the only form Meta accepts for
 * personal identifiers. Normalization must match Meta's rules or the hash will
 * not match theirs and the key is silently wasted: lowercase, trimmed, and for
 * phones digits only with country code and no leading "+".
 */
function hash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function hashName(value: string | null): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized ? hash(normalized) : null;
}

function hashPhone(value: string | null): string | null {
  const digits = value?.replace(/\D/g, "");
  return digits ? hash(digits) : null;
}

/** Drops null/undefined keys — Meta rejects `user_data` entries with empty values. */
function compact(input: Record<string, string | null>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(input).filter((entry): entry is [string, string] => entry[1] != null)
  );
}

/**
 * Creates a function that reports one `Lead` to the Meta Conversions API.
 *
 * Never throws and never blocks the caller's response: a marketing pixel must
 * not be able to fail a loan application. Returns whether the event was
 * accepted so callers and tests can assert on it.
 *
 * @param deps - Dataset credentials and injectable fetch/clock
 */
export function createSendLeadConversion(deps: SendLeadConversionDeps) {
  const { pixelId, accessToken, testEventCode } = deps;
  const fetchFn = deps.fetchFn ?? fetch;
  const now = deps.now ?? (() => new Date());

  return async (lead: LeadConversion): Promise<boolean> => {
    // Unconfigured is the normal local/dev state, not an error. Mirrors the
    // site's guard, where an unset VITE_META_PIXEL_ID means the pixel never loads.
    if (!pixelId || !accessToken) return false;

    if (!lead.eventId) {
      // Sending anyway would double-count against the browser event.
      logger.warn("meta capi: lead has no eventId, skipping to avoid double counting");
      return false;
    }

    const userData = compact({
      ph: hashPhone(lead.phone),
      fn: hashName(lead.firstName),
      ln: hashName(lead.lastName),
      fbc: lead.fbc,
      fbp: lead.fbp,
      client_ip_address: lead.clientIpAddress,
      client_user_agent: lead.clientUserAgent
    });

    const payload: Record<string, unknown> = {
      data: [
        {
          event_name: "Lead",
          event_time: Math.floor((lead.eventTime ?? now()).getTime() / 1000),
          event_id: lead.eventId,
          action_source: "website",
          ...(lead.eventSourceUrl ? { event_source_url: lead.eventSourceUrl } : {}),
          user_data: userData
        }
      ]
    };
    if (testEventCode) payload.test_event_code = testEventCode;

    const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(accessToken)}`;

    try {
      const res = await fetchFn(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        // Meta puts the real reason in the body; the status alone is useless.
        const body = await res.text().catch(() => "");
        logger.error("meta capi: lead rejected", {
          status: res.status,
          // Never log user_data — it is hashed, but it is still applicant data.
          eventId: lead.eventId,
          body: body.slice(0, 500)
        });
        return false;
      }

      logger.verbose("meta capi: lead sent", {
        eventId: lead.eventId,
        matchKeys: Object.keys(userData).length
      });
      return true;
    } catch (err) {
      logger.error("meta capi: lead request failed", {
        eventId: lead.eventId,
        error: err instanceof Error ? err.message : String(err)
      });
      return false;
    }
  };
}
