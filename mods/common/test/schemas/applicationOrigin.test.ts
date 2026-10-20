/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import {
  AD_ATTRIBUTION_START,
  APPLICATION_ORIGIN_LABELS,
  APPLICATION_ORIGIN_LABELS_ES,
  applicationOrigin,
  applicationOriginEnum,
  listApplicationsSchema
} from "../../src/schemas/application.js";

const AFTER = new Date("2026-10-01T12:00:00.000Z");
const BEFORE = new Date("2026-09-10T12:00:00.000Z");

describe("applicationOrigin", () => {
  it("is ad for a form application with an adId", () => {
    expect(applicationOrigin({ source: "FORM", adId: "120", createdAt: AFTER })).to.equal("ad");
  });

  it("is ad even before tracking when the row has an adId", () => {
    expect(applicationOrigin({ source: "FORM", adId: "120", createdAt: BEFORE })).to.equal("ad");
  });

  it("is organic for a form application without an adId after tracking went live", () => {
    expect(applicationOrigin({ source: "FORM", adId: null, createdAt: AFTER })).to.equal("organic");
  });

  it("is unknown for a form application without an adId from before tracking", () => {
    expect(applicationOrigin({ source: "FORM", adId: null, createdAt: BEFORE })).to.equal(
      "unknown"
    );
  });

  it("puts the cutoff instant itself on the organic side", () => {
    const at = AD_ATTRIBUTION_START;
    const justBefore = new Date(at.getTime() - 1);
    expect(applicationOrigin({ source: "FORM", createdAt: at })).to.equal("organic");
    expect(applicationOrigin({ source: "FORM", createdAt: justBefore })).to.equal("unknown");
  });

  it("accepts an ISO string date (rows over tRPC)", () => {
    expect(applicationOrigin({ source: "FORM", createdAt: AFTER.toISOString() })).to.equal(
      "organic"
    );
  });

  it("is whatsapp or manual by source, whatever the adId", () => {
    expect(applicationOrigin({ source: "WHATSAPP", adId: "120", createdAt: AFTER })).to.equal(
      "whatsapp"
    );
    expect(applicationOrigin({ source: "MANUAL", adId: "120", createdAt: AFTER })).to.equal(
      "manual"
    );
  });

  it("has a CLI and an Ops label for every origin", () => {
    for (const o of applicationOriginEnum.options) {
      expect(APPLICATION_ORIGIN_LABELS[o], o).to.be.a("string").and.not.empty;
      expect(APPLICATION_ORIGIN_LABELS_ES[o], o).to.be.a("string").and.not.empty;
    }
    expect(APPLICATION_ORIGIN_LABELS.ad).to.equal("Form (ad)");
    expect(APPLICATION_ORIGIN_LABELS_ES.organic).to.equal("Formulario (orgánico)");
  });

  it("rejects an unknown origin filter", () => {
    expect(listApplicationsSchema.safeParse({ origin: "facebook" }).success).to.equal(false);
    expect(listApplicationsSchema.safeParse({ origin: "ad" }).success).to.equal(true);
  });
});
