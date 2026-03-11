/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { generateRenewalCandidatesReportSchema } from "@mikro/common";

describe("generateRenewalCandidatesReportSchema", () => {
  it("accepts empty input", () => {
    const result = generateRenewalCandidatesReportSchema.parse({});
    expect(result).to.deep.equal({});
  });
});
