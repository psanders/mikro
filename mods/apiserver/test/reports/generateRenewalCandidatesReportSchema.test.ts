/**
 * Copyright (C) 2026 by Mikro SRL. MIT License.
 */
import { expect } from "chai";
import { generateRenewalCandidatesReportSchema } from "@mikro/common";

describe("generateRenewalCandidatesReportSchema", () => {
  it("accepts empty input, defaulting format to pdf", () => {
    const result = generateRenewalCandidatesReportSchema.parse({});
    expect(result).to.deep.equal({ format: "pdf" });
  });

  it("accepts an explicit json format", () => {
    const result = generateRenewalCandidatesReportSchema.parse({ format: "json" });
    expect(result).to.deep.equal({ format: "json" });
  });
});
