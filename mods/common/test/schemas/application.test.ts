/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import {
  applicationPayloadSchema,
  normalizeApplication,
  extractAttribution,
  APPLICATION_TRACKING_KEYS,
  APPLICATION_ATTRIBUTION_KEYS
} from "../../src/schemas/application.js";

describe("normalizeApplication — Meta tracking fields", () => {
  const payload = {
    sessionId: "sess-1",
    partial: false,
    firstName: "Juana",
    phone: "(829) 871-7987",
    eventId: "evt-1",
    fbp: "fb.1.456.def",
    fbc: "fb.1.123.abc",
    eventSourceUrl: "https://mikro.do/solicitud"
  };

  it("parses the tracking fields rather than dropping them", () => {
    const parsed = applicationPayloadSchema.parse(payload);
    expect(parsed.eventId).to.equal("evt-1");
    expect(parsed.fbp).to.equal("fb.1.456.def");
    expect(parsed.fbc).to.equal("fb.1.123.abc");
    expect(parsed.eventSourceUrl).to.equal("https://mikro.do/solicitud");
  });

  // Regression: the site posts `fbc: null` / `fbp: null` when the browser has
  // no Meta cookie. Rejecting null made the endpoint drop the final submission
  // as an invalid payload (while answering "ok"), leaving the row a DRAFT.
  it("accepts null tracking cookies, as the site sends them when absent", () => {
    const parsed = applicationPayloadSchema.safeParse({ ...payload, fbp: null, fbc: null });
    expect(parsed.success).to.equal(true);
  });

  it("keeps tracking cookies out of rawData, which is persisted with the application", () => {
    const normalized = normalizeApplication(applicationPayloadSchema.parse(payload));

    for (const key of APPLICATION_TRACKING_KEYS) {
      expect(normalized.rawData, `rawData should not carry ${key}`).to.not.have.property(key);
    }
    // The applicant's own answers still land there.
    expect(normalized.rawData).to.not.be.empty;
    expect(normalized.firstName).to.equal("Juana");
    expect(normalized.phone).to.equal("+18298717987");
  });

  it("still normalizes when the form sends no tracking fields at all", () => {
    const normalized = normalizeApplication(
      applicationPayloadSchema.parse({ sessionId: "sess-2", firstName: "Luis" })
    );
    expect(normalized.firstName).to.equal("Luis");
    expect(normalized.partial).to.be.false;
  });

  it("keeps tolerating unknown form fields by putting them in rawData", () => {
    const normalized = normalizeApplication(
      applicationPayloadSchema.parse({ sessionId: "sess-3", somethingNew: "x" })
    );
    expect(normalized.rawData.somethingNew).to.equal("x");
  });
});

/**
 * Ad attribution is the mirror image of the tracking cookies above: both are
 * stripped from `rawData`, but these are kept — as columns and catalog rows —
 * because they are the join key that lets lead quality be reported per ad
 * (issue #280).
 */
describe("normalizeApplication — ad attribution", () => {
  const payload = {
    sessionId: "sess-ad",
    firstName: "Juana",
    adId: "120212",
    adsetId: "120211",
    campaignId: "120210",
    adName: "MIKRO | Business owner | v2",
    adsetName: "Prospecting",
    campaignName: "MIKRO | Leads"
  };

  it("lifts the ad parameters out of rawData, which holds the applicant's answers", () => {
    const normalized = normalizeApplication(applicationPayloadSchema.parse(payload));

    for (const key of APPLICATION_ATTRIBUTION_KEYS) {
      expect(normalized.rawData, `rawData should not carry ${key}`).to.not.have.property(key);
    }
    expect(normalized.attribution?.adId).to.equal("120212");
    expect(normalized.attribution?.adName).to.equal("MIKRO | Business owner | v2");
    expect(normalized.firstName).to.equal("Juana");
  });

  it("omits attribution entirely for an organic submission", () => {
    const normalized = normalizeApplication(
      applicationPayloadSchema.parse({ sessionId: "sess-organic", firstName: "Luis" })
    );

    // Absent rather than all-null: the upsert uses that difference to leave an
    // already-recorded ad alone instead of erasing it.
    expect(normalized.attribution).to.equal(undefined);
  });

  it("ignores a name that arrives without an ad id — that is not attribution", () => {
    const normalized = normalizeApplication(
      applicationPayloadSchema.parse({ sessionId: "sess-partial", adName: "MIKRO | Online | v2" })
    );

    expect(normalized.attribution).to.equal(undefined);
  });

  it("reads the ad parameters off a validated payload", () => {
    const attribution = extractAttribution(applicationPayloadSchema.parse(payload));

    expect(attribution.adsetId).to.equal("120211");
    expect(attribution.campaignName).to.equal("MIKRO | Leads");
  });

  it("treats blank parameters as absent, not as an ad called empty string", () => {
    const attribution = extractAttribution(
      applicationPayloadSchema.parse({ sessionId: "sess-blank", adId: "   ", adName: "" })
    );

    expect(attribution.adId).to.equal(null);
    expect(attribution.adName).to.equal(null);
  });
});
