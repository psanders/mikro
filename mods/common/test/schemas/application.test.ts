/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import {
  applicationPayloadSchema,
  normalizeApplication,
  APPLICATION_TRACKING_KEYS
} from "../../src/schemas/application.js";

describe("normalizeApplication — ad-attribution fields", () => {
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
