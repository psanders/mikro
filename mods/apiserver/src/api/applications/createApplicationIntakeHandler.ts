/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { applicationPayloadSchema, normalizeApplication, extractTracking } from "@mikro/common";
import type { LoanApplication, NormalizedApplication } from "@mikro/common";
import type { LeadConversion } from "../marketing/createSendLeadConversion.js";
import { logger } from "../../logger.js";
import { OUT_OF_COVERAGE_AREA } from "./createUpsertApplication.js";

/** The slice of an Express request the intake reads. */
export interface IntakeRequest {
  body: unknown;
  ip?: string;
  get(header: string): string | undefined;
}

/** The slice of an Express response the intake writes. */
export interface IntakeResponse {
  status(code: number): IntakeResponse;
  json(body: unknown): unknown;
}

interface Deps {
  /** The website-intake upsert (built with `coveredProvinces`). */
  upsertApplication: (input: NormalizedApplication) => Promise<LoanApplication>;
  /** Server-side Meta Lead (CAPI). */
  sendLeadConversion: (lead: LeadConversion) => Promise<boolean>;
}

/**
 * Body of the public `POST /v1/applications` endpoint (the website form's
 * autosaves, leave-page beacon, and final submit), extracted from index.ts so
 * its side effects can be unit tested. Rate limiting stays in the route.
 *
 * Responses always carry `result: "ok"` unless persistence itself failed, so
 * autosaves and beacons stay silent for the applicant. A final submission the
 * upsert auto-rejected for its province additionally carries
 * `outcome: "out_of_area"` — the site shows the "not in your city yet" screen
 * on it — and is NOT reported to Meta as a Lead: optimizing ads toward people
 * we cannot lend to would buy more of them.
 */
export function createApplicationIntakeHandler(deps: Deps) {
  return async (req: IntakeRequest, res: IntakeResponse): Promise<void> => {
    // `sendBeacon` bodies land here as a raw string (Content-Type "text/plain"),
    // parsed by the express.text() middleware; a normal fetch POST lands as an
    // already-parsed object. Bad JSON from a beacon is the same as any other
    // malformed payload below: logged, answered "ok" so the tab that's already
    // closing never sees an error.
    let body: unknown = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        logger.warn("application intake: invalid beacon body (not JSON)");
        res.json({ result: "ok" });
        return;
      }
    }

    const parsed = applicationPayloadSchema.safeParse(body);
    if (!parsed.success) {
      // Lenient: log server-side, don't leak schema details. Still 200 so partial
      // autosaves stay silent for the user.
      logger.warn("application intake: invalid payload", {
        sessionId: (body as { sessionId?: unknown })?.sessionId,
        issues: parsed.error.issues.length
      });
      res.json({ result: "ok" });
      return;
    }

    try {
      const normalized = normalizeApplication(parsed.data);
      const application = await deps.upsertApplication(normalized);
      const outOfArea =
        !normalized.partial &&
        application.status === "REJECTED" &&
        application.rejectionReason === OUT_OF_COVERAGE_AREA;

      if (outOfArea) {
        res.json({ result: "ok", outcome: "out_of_area" });
        return;
      }
      res.json({ result: "ok" });

      // Only a completed submission is a Lead — partial autosaves fire on every
      // section and would report the same applicant many times. Deliberately
      // after res.json and not awaited: Meta must never delay or fail an
      // application.
      if (!normalized.partial) {
        const tracking = extractTracking(parsed.data);
        deps
          .sendLeadConversion({
            eventId: tracking.eventId ?? "",
            phone: normalized.phone,
            firstName: normalized.firstName,
            lastName: normalized.lastName,
            fbc: tracking.fbc,
            fbp: tracking.fbp,
            // From the request, not the body: a client could put anything in the body.
            clientIpAddress: req.ip ?? null,
            clientUserAgent: req.get("user-agent") ?? null,
            eventSourceUrl: tracking.eventSourceUrl
          })
          .catch((err: Error) => {
            logger.error("meta capi: unexpected send failure", { error: err.message });
          });
      }
    } catch (err) {
      logger.error("application intake: upsert failed", {
        sessionId: parsed.data.sessionId,
        error: err instanceof Error ? err.message : String(err)
      });
      res.status(500).json({ result: "error" });
    }
  };
}
