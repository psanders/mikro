/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 *
 * Unit tests for createGenerateRenewalCandidatesReport. Threshold and inclusion
 * logic is covered by renewalReportHelpers.test.ts; schema by generateRenewalCandidatesReportSchema.test.ts.
 */
import { expect } from "chai";
import { createGenerateRenewalCandidatesReport } from "../../src/api/reports/createGenerateRenewalCandidatesReport.js";

describe("createGenerateRenewalCandidatesReport", () => {
  it("returns a function that accepts empty input", () => {
    const mockDb = { loan: { findMany: () => Promise.resolve([]) } };
    const fn = createGenerateRenewalCandidatesReport(mockDb as never);
    expect(fn).to.be.a("function");
    expect(fn({})).to.be.a("promise");
  });
});
