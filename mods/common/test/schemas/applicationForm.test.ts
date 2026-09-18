/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Form completeness: how far an applicant got before they left, computed from
 * the same `rawData` + `lastSection` shape a DRAFT `LoanApplication` stores.
 * The behaviour worth protecting is that this stays a pure, lenient read of
 * whatever is on hand — never a validator, never a thrower.
 */
import { expect } from "chai";
import {
  APPLICATION_SECTIONS,
  computeFormProgress,
  isSectionComplete,
  buildAutosavePayload
} from "../../src/schemas/applicationForm.js";

const REQUIRED_TOTAL = APPLICATION_SECTIONS.reduce((sum, s) => sum + s.requiredFields.length, 0);

describe("computeFormProgress", () => {
  it("reads an empty draft as having reached nothing", () => {
    const progress = computeFormProgress({}, null);
    expect(progress.sectionsReached).to.equal(0);
    expect(progress.requiredFilled).to.equal(0);
    expect(progress.requiredTotal).to.equal(REQUIRED_TOTAL);
    expect(progress.completeness).to.equal(0);
  });

  it("tolerates missing rawData entirely rather than throwing", () => {
    const progress = computeFormProgress(undefined, undefined);
    expect(progress.sectionsReached).to.equal(0);
    expect(progress.requiredFilled).to.equal(0);
  });

  it("scores a partial draft by required fields filled and the section reached", () => {
    const progress = computeFormProgress(
      {
        firstName: "Juana",
        lastName: "Pérez",
        phone: "+18298717987",
        // idNumber, dateOfBirth, maritalStatus left blank
        businessType: "COLMADO"
        // rest of negocio left blank
      },
      "negocio"
    );

    expect(progress.sectionsReached).to.equal(2); // personal (1) + negocio (2)
    expect(progress.requiredFilled).to.equal(4);
    expect(progress.completeness).to.be.closeTo(4 / REQUIRED_TOTAL, 1e-9);
  });

  it("treats blank strings the same as missing fields", () => {
    const progress = computeFormProgress({ firstName: "  ", lastName: "" }, "personal");
    expect(progress.requiredFilled).to.equal(0);
  });

  it("scores a fully filled form as complete, regardless of section order reached", () => {
    const allFields: Record<string, string> = {};
    for (const section of APPLICATION_SECTIONS) {
      for (const key of section.requiredFields) allFields[key] = "x";
    }

    const progress = computeFormProgress(allFields, "vivienda");
    expect(progress.sectionsReached).to.equal(5);
    expect(progress.requiredFilled).to.equal(REQUIRED_TOTAL);
    expect(progress.completeness).to.equal(1);
  });

  it("reads an unrecognized lastSection as having reached nothing, not as an error", () => {
    const progress = computeFormProgress({ firstName: "Juana" }, "some-removed-section");
    expect(progress.sectionsReached).to.equal(0);
    expect(progress.requiredFilled).to.equal(1);
  });
});

describe("isSectionComplete", () => {
  it("is false when any required field of the section is blank", () => {
    expect(isSectionComplete("credito", { requestedAmount: "50,000", purpose: "" })).to.equal(
      false
    );
  });

  it("is true once every required field of the section is filled", () => {
    expect(
      isSectionComplete("credito", {
        requestedAmount: "50,000",
        purpose: "Capital de trabajo",
        requestedTermWeeks: "18 semanas"
      })
    ).to.equal(true);
  });

  it("ignores fields from other sections", () => {
    expect(
      isSectionComplete("credito", {
        requestedAmount: "50,000",
        purpose: "Capital de trabajo",
        requestedTermWeeks: "18 semanas",
        firstName: "" // personal's field, blank, must not affect credito
      })
    ).to.equal(true);
  });

  it("is false for an unrecognized section id", () => {
    expect(isSectionComplete("nope", { anything: "x" })).to.equal(false);
  });
});

describe("buildAutosavePayload", () => {
  it("merges the form, the attribution, and the autosave envelope into one payload", () => {
    const payload = buildAutosavePayload(
      { firstName: "Juana" },
      { adId: "120212", adName: "MIKRO | Business owner | v2" },
      "sess-1",
      "negocio"
    );

    expect(payload).to.deep.equal({
      firstName: "Juana",
      adId: "120212",
      adName: "MIKRO | Business owner | v2",
      sessionId: "sess-1",
      partial: true,
      lastSection: "negocio"
    });
  });

  it("marks every autosave partial, never final, regardless of form completeness", () => {
    const payload = buildAutosavePayload({}, {}, "sess-2", "vivienda");
    expect(payload.partial).to.equal(true);
  });

  it("produces the same shape for an empty attribution as for an organic visit", () => {
    const payload = buildAutosavePayload({ firstName: "Luis" }, {}, "sess-3", "personal");
    expect(payload).to.deep.equal({
      firstName: "Luis",
      sessionId: "sess-3",
      partial: true,
      lastSection: "personal"
    });
  });
});
